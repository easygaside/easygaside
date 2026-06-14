-- ─────────────────────────────────────────────────────────────
-- easygas baseline schema: egs_projects / egs_files / egs_messages / egs_deployments
-- All tables owner-scoped via RLS (owner_id = auth.uid()).
-- ─────────────────────────────────────────────────────────────

-- 1 project = 1 GAS app of a user
create table if not exists egs_projects (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  kind               text not null default 'webapp' check (kind in ('webapp', 'bound')),
  script_id          text,                 -- Apps Script scriptId (after projects.create)
  bound_sheet_id     text,                 -- Drive fileId when kind = 'bound'
  scratch_script_id  text,                 -- Tier-2 preview scratch script
  token_spend_input  bigint not null default 0,
  token_spend_output bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (owner_id, name)                  -- enables upsert on (owner_id, name)
);

-- Files in a project (.gs / .html / appsscript.json) — the agent loop's mutation target
create table if not exists egs_files (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references egs_projects(id) on delete cascade,
  path         text not null,              -- 'Code.gs', 'Index.html', 'appsscript.json'
  content      text not null default '',
  content_hash text not null default '',   -- sha256 — staleness check for edit_file
  updated_at   timestamptz not null default now(),
  unique (project_id, path)
);

-- Conversation history (resume the loop after disconnect / maxDuration)
create table if not exists egs_messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references egs_projects(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     jsonb not null,              -- Anthropic content blocks (tool_use / tool_result preserved)
  turn_type   text not null default 'codegen' check (turn_type in ('codegen', 'plan')),
  created_at  timestamptz not null default now()
);

-- Deployments — PATCH the same deployment forever (hard cap 20/script)
create table if not exists egs_deployments (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references egs_projects(id) on delete cascade,
  deployment_id  text not null,            -- Apps Script deploymentId (reuse → PATCH)
  entry_type     text not null default 'webapp' check (entry_type in ('webapp', 'api_executable')),
  exec_url       text,                     -- .../macros/s/{id}/exec
  version_number int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (project_id, entry_type)          -- one deployment per kind/project (reused + PATCHed)
);

create index if not exists egs_files_project_idx       on egs_files(project_id);
create index if not exists egs_messages_project_idx     on egs_messages(project_id);
create index if not exists egs_deployments_project_idx  on egs_deployments(project_id);

-- ── RLS ──
alter table egs_projects    enable row level security;
alter table egs_files       enable row level security;
alter table egs_messages    enable row level security;
alter table egs_deployments enable row level security;

-- egs_projects: direct owner check
create policy "egs_projects owner" on egs_projects
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- child tables: owner check via parent project
create policy "egs_files owner" on egs_files
  for all using (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  );

create policy "egs_messages owner" on egs_messages
  for all using (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  );

create policy "egs_deployments owner" on egs_deployments
  for all using (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  ) with check (
    project_id in (select id from egs_projects where owner_id = auth.uid())
  );
