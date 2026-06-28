-- Track the oauthScopes deployed per web-app deployment, to detect scope GROWTH on redeploy.
-- When a later deploy adds a scope the owner hasn't granted (consent B / the script's own runtime
-- authorization — customer-side, per-project, NOT easygas's /connect grant), the UI nudges the owner
-- to re-authorize their app. See docs/CRITIC-FINDINGS.md §5 (prompt-vs-throw) + §7 (re-consent).

alter table public.egs_deployments
  add column if not exists oauth_scopes text[] not null default '{}';

comment on column public.egs_deployments.oauth_scopes is
  'oauthScopes in the manifest of the last deploy. Used to detect scope growth on redeploy (consent B / customer-side, per-project) so the UI can prompt the owner to re-authorize. See docs/CRITIC-FINDINGS.md.';
