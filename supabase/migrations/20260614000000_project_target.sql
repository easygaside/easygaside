-- ─────────────────────────────────────────────────────────────
-- Pluggable deployment target (BUILDPLAN §J.6): tag each project with the runtime it ships to
-- + a free-form spec (purpose / data model / capabilityNeeds / style). Default 'gas' so every
-- existing row keeps deploying to Apps Script unchanged.
-- ─────────────────────────────────────────────────────────────

alter table egs_projects
  add column if not exists target text not null default 'gas'
    check (target in ('gas', 'web-supabase', 'static-web')),
  add column if not exists spec jsonb;
