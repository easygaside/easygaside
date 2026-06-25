-- Cache whether the connected Google account has the per-user Apps Script API toggle enabled
-- (script.google.com/home/usersettings). Set true after a successful probe/deploy so we don't
-- re-probe Google on every page load. Default false = not-yet-verified.
alter table public.google_connections
  add column if not exists apps_script_ready boolean not null default false;
