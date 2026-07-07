-- P2-9 (v2 audit): (1) wrap auth.uid() as (select auth.uid()) in every owner policy so it is
-- evaluated ONCE per query (initplan) instead of per row; (2) add covering indexes on unindexed FKs.
-- The policy bodies are otherwise byte-identical → same security semantics, just faster at scale.

-- owner policies keyed by project ownership (project_id IN owned projects)
drop policy if exists "egs_chat_images owner" on public.egs_chat_images;
create policy "egs_chat_images owner" on public.egs_chat_images for all
  using (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())))
  with check (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())));

drop policy if exists "egs_deployments owner" on public.egs_deployments;
create policy "egs_deployments owner" on public.egs_deployments for all
  using (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())))
  with check (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())));

drop policy if exists "egs_file_versions owner" on public.egs_file_versions;
create policy "egs_file_versions owner" on public.egs_file_versions for all
  using (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())))
  with check (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())));

drop policy if exists "egs_files owner" on public.egs_files;
create policy "egs_files owner" on public.egs_files for all
  using (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())))
  with check (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())));

drop policy if exists "egs_messages owner" on public.egs_messages;
create policy "egs_messages owner" on public.egs_messages for all
  using (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())))
  with check (project_id in (select id from public.egs_projects where owner_id = (select auth.uid())));

-- owner policies keyed directly by user_id / owner_id
drop policy if exists "egs_projects owner" on public.egs_projects;
create policy "egs_projects owner" on public.egs_projects for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "egs_generations insert own" on public.egs_generations;
create policy "egs_generations insert own" on public.egs_generations for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "egs_generations rate own" on public.egs_generations;
create policy "egs_generations rate own" on public.egs_generations for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "egs_reports insert own" on public.egs_reports;
create policy "egs_reports insert own" on public.egs_reports for insert
  with check (user_id = (select auth.uid()));

drop policy if exists "own upgrade requests" on public.egs_upgrade_requests;
create policy "own upgrade requests" on public.egs_upgrade_requests for select
  using (user_id = (select auth.uid()));

drop policy if exists "egs_usage_daily owner read" on public.egs_usage_daily;
create policy "egs_usage_daily owner read" on public.egs_usage_daily for select
  using (user_id = (select auth.uid()));

drop policy if exists "own google connection" on public.google_connections;
create policy "own google connection" on public.google_connections for select
  using ((select auth.uid()) = user_id);

-- covering indexes for FKs flagged unindexed by the performance advisor
create index if not exists egs_generations_project_id_idx on public.egs_generations (project_id);
create index if not exists egs_reports_project_id_idx on public.egs_reports (project_id);
create index if not exists egs_reports_user_id_idx on public.egs_reports (user_id);
create index if not exists egs_beta_applications_user_id_idx on public.egs_beta_applications (user_id);
create index if not exists egs_upgrade_requests_user_id_idx on public.egs_upgrade_requests (user_id);
