-- P0-4 (v2 audit 2026-07-07): a project must have at most ONE webapp deployment row.
-- /api/deploy takes no per-project lock, so a concurrent double-deploy on a fresh
-- project both read existing=null, called createProject twice, and inserted two
-- entry_type='webapp' rows — permanently orphaning one /exec URL (all later deploys
-- .limit(1) the newest). This partial unique index makes the second row impossible.
-- (Verified no duplicates existed before adding.)
create unique index if not exists egs_deployments_webapp_uniq
  on public.egs_deployments (project_id)
  where entry_type = 'webapp';
