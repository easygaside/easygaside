-- P1-1/1-3 (v2 audit): separate "reviewed clean" from "not a real verdict" so the clean-rate
-- metric (used to decide the free arm) stops counting critic crashes / truncated-unparseable
-- replies as clean passes. null = not applicable (non-codegen / verify); 'clean' = reviewed, no
-- issues; 'issues' = reviewed, found issues; 'skipped' = critic errored/unconfigured; 'degraded'
-- = reply unparseable/truncated even after retry.
alter table public.egs_generations add column if not exists critic_status text;
comment on column public.egs_generations.critic_status is
  'How the rulebook critic ran for this gen: null|clean|issues|skipped|degraded. Excludes skipped/degraded from the trustworthy clean-rate (v2 audit P1-1/1-3).';
