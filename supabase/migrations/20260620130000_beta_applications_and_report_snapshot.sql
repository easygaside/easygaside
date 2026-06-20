-- Two schema drifts where the code references objects no migration ever created:
--  1. egs_beta_applications — the closed-beta application/survey form (app/beta) upserts here, but
--     the table never existed, so every submit failed ("relation does not exist").
--  2. egs_reports.code_snapshot + the 'broken' kind — the failure-capture flywheel writes a file
--     snapshot and a 'broken' report kind, but the reports table had neither (kind check only allowed
--     bug/idea/other, and there was no snapshot column), so the admin reports query errored out.

-- 1) Beta application + screening survey. Service-role only (app/beta/actions.ts and the admin
--    approve/reject actions write via the service role); no client policy → RLS denies clients.
create table if not exists egs_beta_applications (
  email            text primary key,
  user_id          uuid references auth.users(id) on delete set null,
  email_verified   boolean not null default false,
  name             text,
  business_type    text,
  build_idea       text not null,
  tech_level       text,
  device           text,
  willing_feedback boolean not null default false,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists egs_beta_applications_status_idx
  on egs_beta_applications(status, created_at desc);
alter table egs_beta_applications enable row level security;

-- 2) Report code snapshot (jsonb array of {path, content}) + allow the 'broken' kind.
alter table egs_reports add column if not exists code_snapshot jsonb;
alter table egs_reports drop constraint if exists egs_reports_kind_check;
alter table egs_reports add constraint egs_reports_kind_check
  check (kind in ('bug', 'idea', 'other', 'broken'));
