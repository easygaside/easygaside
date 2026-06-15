-- Move the per-user daily generation cap into admin (egs_app_settings).
insert into egs_app_settings (key, value) values ('daily_limit', '30')
on conflict (key) do nothing;
