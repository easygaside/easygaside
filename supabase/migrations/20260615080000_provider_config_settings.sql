-- Superadmin-editable model per provider + the system-wide default provider. Service-role only.
create table if not exists egs_provider_config (
  provider text primary key check (provider in ('claude', 'chatgpt', 'deepseek')),
  model    text not null
);
insert into egs_provider_config (provider, model) values
  ('claude', 'claude-sonnet-4-6'),
  ('chatgpt', 'gpt-4o'),
  ('deepseek', 'deepseek-chat')
on conflict (provider) do nothing;

create table if not exists egs_app_settings (
  key   text primary key,
  value text
);
insert into egs_app_settings (key, value) values ('default_provider', 'claude')
on conflict (key) do nothing;

alter table egs_provider_config enable row level security;
alter table egs_app_settings enable row level security;
