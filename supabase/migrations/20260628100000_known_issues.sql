-- Known-issues / analysis ledger.
-- Records critic-quality findings that have ALREADY been analyzed (see docs/CRITIC-FINDINGS.md)
-- so future automated runs — or a fresh Claude session — can dedupe and skip re-analyzing the same thing.
-- Platform-internal knowledge (NOT owner-scoped): RLS enabled with NO policy => service-role only.

create table if not exists public.egs_known_issues (
  id                uuid primary key default gen_random_uuid(),
  signature         text not null unique,                 -- stable dedupe key
  title             text not null,
  category          text not null check (category in (
                      'critic-rule-added','critic-false-positive','codegen-pattern','platform-gap','user-incident')),
  severity          text check (severity in ('high','medium','low')),
  status            text not null default 'analyzed' check (status in (
                      'analyzed','fixed','mitigated','wontfix','open')),
  resolution        text,
  affected_projects uuid[] not null default '{}',
  ref_doc           text,
  analyzed_at       timestamptz not null default now()
);

alter table public.egs_known_issues enable row level security;

comment on table public.egs_known_issues is
  'Ledger of critic-quality findings already analyzed (see docs/CRITIC-FINDINGS.md). Platform-internal; RLS on, no policy => service-role only. Consult before re-analyzing critic issues; skip signatures already fixed/analyzed.';

-- Internal-only table: no client ever reads it. Remove it from the PostgREST surface entirely
-- (defense-in-depth on top of RLS) so anon/authenticated can't even probe its schema.
revoke all on public.egs_known_issues from anon, authenticated;

insert into public.egs_known_issues
  (signature, title, category, severity, status, resolution, affected_projects, ref_doc)
values
  ('critic-rule:endpoint-authorization',
   'google.script.run admin/secret endpoints lack server-side auth',
   'critic-rule-added', 'high', 'fixed',
   'Added rule to CRITIC_SYSTEM (lib/critic.ts).', '{}', 'docs/CRITIC-FINDINGS.md'),

  ('critic-rule:reentrant-lock-deadlock',
   'Re-entrant / nested LockService deadlock (lock taken twice in one call chain)',
   'critic-rule-added', 'high', 'fixed',
   'Added rule to CRITIC_SYSTEM (lib/critic.ts).', '{}', 'docs/CRITIC-FINDINGS.md'),

  ('critic-rule:status-transition-guard',
   'State-changing entry point sets new status without verifying current status',
   'critic-rule-added', 'medium', 'fixed',
   'Added rule to CRITIC_SYSTEM (lib/critic.ts).', '{}', 'docs/CRITIC-FINDINGS.md'),

  ('critic-rule:doget-provisioning-blocks-render',
   'doGet provisioning/trigger setup throws and blanks the whole page incl. login',
   'critic-rule-added', 'high', 'fixed',
   'Added rule #4 to CRITIC_SYSTEM (lib/critic.ts) + codegen prompt guidance (lib/gas-codegen.ts).',
   '{}'  -- affected project UUIDs live only in the runtime ledger, not in version control,
   'docs/CRITIC-FINDINGS.md'),

  ('critic-fp:script-storage-hallucination',
   'Critic invents non-existent auth/script.storage scope + misattributes PropertiesService scope (R3 false-positive ~15-23%)',
   'critic-false-positive', null, 'fixed',
   'Added GAS service->scope ground-truth map to CRITIC_SYSTEM + codegen prompt. PropertiesService/LockService need no scope; script.storage does not exist.',
   '{}', 'docs/CRITIC-FINDINGS.md'),

  ('codegen:oauthscopes-mismatch',
   'Codegen recurrently writes over-broad / missing appsscript.json oauthScopes (R3 = 10.3% of critic hits; deployed verbatim)',
   'codegen-pattern', null, 'mitigated',
   'Scope map added to codegen prompt; deterministic scope-deriver from referenced services still TODO.',
   '{}', 'docs/CRITIC-FINDINGS.md'),

  ('platform-gap:scope-change-needs-reauth',
   'Adding a manifest scope has no effect until owner re-authorizes; deploy flow does not force re-consent on scope change',
   'platform-gap', null, 'mitigated',
   'Mitigated: codegen+critic require a ScriptApp.getAuthorizationInfo(FULL) guard in doGet (apps self-heal on scope growth); egs_deployments.oauth_scopes + deployProject.scopesAdded drive a re-consent note in DeployButton. Scope B (customer-side), NOT /connect. Residual: anonymous users cannot consent; owner approves once.',
   '{}', 'docs/CRITIC-FINDINGS.md'),

  ('user-incident:fire-extinguisher-trigger-scope',
   'ScriptApp.getProjectTriggers permission error in doGet -> login page broken (same root cause)',
   'user-incident', 'high', 'analyzed',
   'Root cause: R3 missing auth/script.scriptapp on the DEPLOYED version + doGet provisioning cascade. Manifest now has the scope; user must redeploy + re-authorize and must not restore no_scope versions.',
   '{}'  -- affected project UUIDs live only in the runtime ledger, not in version control,
   'docs/CRITIC-FINDINGS.md')
on conflict (signature) do nothing;
