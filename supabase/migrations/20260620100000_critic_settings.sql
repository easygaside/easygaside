-- Make the shared rulebook critic (gate 1) admin-editable too. Only claude/deepseek backends are
-- implemented (lib/critic.ts), so the admin UI constrains the choice to those two. API keys stay in env.
insert into egs_app_settings (key, value) values
  ('critic_provider', 'deepseek'),  -- claude | deepseek
  ('critic_model', 'deepseek-chat') -- model name for the active critic backend
on conflict (key) do nothing;
