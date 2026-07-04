-- Live support chat (paid users <-> admin), delivered over Realtime Broadcast.
-- One thread per user (topic support:{user_id}); message history lives here.
-- RLS enabled with NO policies => service-role only; all reads/writes go through
-- API routes that gate on paid plan (user side) / superadmin (admin side).

create table if not exists public.egs_support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade, -- thread owner (the customer)
  sender text not null check (sender in ('user', 'admin')),
  body text not null check (char_length(body) between 1 and 4000),
  email text,                                                        -- denormalized sender email (user messages) so the admin inbox needs no auth-admin lookups
  project_id uuid references public.egs_projects(id) on delete set null, -- context: which project's IDE the message was sent from
  read_at timestamptz,                                               -- when the RECEIVING side read it
  created_at timestamptz not null default now()
);
comment on table public.egs_support_messages is
  'Live-chat history (paid user <-> admin). Service-role only; realtime delivery via broadcast trigger to private topic support:{user_id}.';
create index if not exists egs_support_messages_thread_idx
  on public.egs_support_messages (user_id, created_at desc);
create index if not exists egs_support_messages_project_idx
  on public.egs_support_messages (project_id);
alter table public.egs_support_messages enable row level security;

-- Broadcast every insert into the thread's PRIVATE topic; user messages also ping
-- the admin lobby so the inbox updates without subscribing to every thread.
create or replace function public.egs_support_broadcast()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id,
      'user_id', new.user_id,
      'sender', new.sender,
      'body', new.body,
      'project_id', new.project_id,
      'created_at', new.created_at
    ),
    'new_message',
    'support:' || new.user_id::text,
    true
  );
  if new.sender = 'user' then
    perform realtime.send(
      jsonb_build_object(
        'user_id', new.user_id,
        'email', new.email,
        'preview', left(new.body, 80),
        'created_at', new.created_at
      ),
      'new_user_message',
      'support:admin-lobby',
      true
    );
  end if;
  return new;
end $$;

drop trigger if exists egs_support_messages_broadcast on public.egs_support_messages;
create trigger egs_support_messages_broadcast
  after insert on public.egs_support_messages
  for each row execute function public.egs_support_broadcast();

-- Realtime authorization: who may SUBSCRIBE (read) which private topics.
-- Clients never broadcast directly (writes go through API routes), so no insert policy.
drop policy if exists egs_support_channel_read on realtime.messages;
create policy egs_support_channel_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      realtime.topic() = 'support:' || (select auth.uid())::text  -- thread owner
      or (realtime.topic() like 'support:%' and public.is_egs_admin()) -- admin: any thread + lobby
    )
  );
