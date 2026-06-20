-- Re-deploy change-detection: remember the hash of the files that actually went live, so a
-- "deploy ใหม่" with no code changes can short-circuit — skip the Apps Script push/version and the
-- egs_file_versions snapshot, and just reuse the same /exec URL. Null on rows deployed before this
-- column existed (treated as "unknown" → next deploy runs normally and backfills the hash).
alter table egs_deployments add column if not exists content_hash text;
