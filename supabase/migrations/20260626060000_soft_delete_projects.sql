-- Soft delete for projects: keep the row (and its files/messages/usage/deployments) on delete so
-- token-usage history isn't lost and the monthly new-tool quota can't be gamed by create→delete.
-- deleted_at NULL = live; non-null = deleted (hidden from the user, still counted + auditable).
alter table public.egs_projects
  add column if not exists deleted_at timestamptz;

-- Fast "live projects, newest first" reads (listProjects).
create index if not exists egs_projects_active_idx
  on public.egs_projects (owner_id, updated_at desc)
  where deleted_at is null;
