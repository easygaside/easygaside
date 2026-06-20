-- logGeneration (lib/metrics.ts) writes cache_read_tokens + cache_creation_tokens (the Anthropic
-- prompt-cache COGS split), but the original egs_generations migration never created them — so EVERY
-- metric insert failed ("column ... does not exist"), leaving the table empty and the /admin overview
-- (token summary, charts, per-project, per-user — all derived from egs_generations) blank. Add them.
alter table egs_generations add column if not exists cache_read_tokens int not null default 0;
alter table egs_generations add column if not exists cache_creation_tokens int not null default 0;
