-- Chat image attachments: compressed reference images a user attaches in chat.
-- Stored in a private storage bucket; this table records each object so we can
-- cascade-delete the storage files when a project is removed.
create table if not exists egs_chat_images (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references egs_projects(id) on delete cascade,
  storage_path text not null,                 -- '{project_id}/{filename}' within the bucket
  media_type   text not null,
  bytes        int,
  created_at   timestamptz not null default now()
);

create index if not exists egs_chat_images_project_idx on egs_chat_images(project_id);

alter table egs_chat_images enable row level security;

create policy "egs_chat_images owner" on egs_chat_images
  for all using (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  );

-- Private bucket (server uploads/reads via service role; policies below are defense-in-depth
-- for any future signed/authenticated client access). 2 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'egs-chat-images', 'egs-chat-images', false, 2097152,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do nothing;

-- Owner-scoped object policies: first path segment must be one of the user's project ids.
create policy "egs chat images read own" on storage.objects
  for select using (
    bucket_id = 'egs-chat-images'
    and (storage.foldername(name))[1] in (select id::text from egs_projects where owner_id = auth.uid())
  );

create policy "egs chat images insert own" on storage.objects
  for insert with check (
    bucket_id = 'egs-chat-images'
    and (storage.foldername(name))[1] in (select id::text from egs_projects where owner_id = auth.uid())
  );

create policy "egs chat images delete own" on storage.objects
  for delete using (
    bucket_id = 'egs-chat-images'
    and (storage.foldername(name))[1] in (select id::text from egs_projects where owner_id = auth.uid())
  );
