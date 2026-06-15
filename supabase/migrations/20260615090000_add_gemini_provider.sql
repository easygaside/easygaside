-- Allow 'gemini' as a 4th provider arm.
alter table egs_user_settings drop constraint if exists egs_user_settings_llm_provider_check;
alter table egs_user_settings add constraint egs_user_settings_llm_provider_check
  check (llm_provider in ('claude', 'chatgpt', 'deepseek', 'gemini'));

alter table egs_provider_config drop constraint if exists egs_provider_config_provider_check;
alter table egs_provider_config add constraint egs_provider_config_provider_check
  check (provider in ('claude', 'chatgpt', 'deepseek', 'gemini'));

insert into egs_provider_config (provider, model) values ('gemini', 'gemini-2.5-flash')
on conflict (provider) do nothing;
