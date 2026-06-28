-- BYO add-on (฿99/mo): paid entitlement to bring your own Anthropic key. The stored key
-- (anthropic_key_enc) is only HONORED while byo_enabled is active and not expired — so the
-- monthly fee actually gates usage, instead of a key being a one-time free unlock.
alter table egs_user_settings
  add column if not exists byo_enabled boolean not null default false,
  add column if not exists byo_expires_at timestamptz;

comment on column egs_user_settings.byo_enabled is 'BYO add-on (฿99/mo) entitlement — gates whether a stored Anthropic key is honored';
comment on column egs_user_settings.byo_expires_at is 'When the BYO add-on lapses; null = no expiry';
