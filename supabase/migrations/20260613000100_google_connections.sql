-- ─────────────────────────────────────────────────────────────
-- google_connections — per-user encrypted Google OAuth refresh token.
--
-- The refresh token is encrypted AES-256-GCM in lib/crypto.ts and stored as three
-- base64 TEXT columns (ciphertext / iv / tag). Token columns are read ONLY by the
-- server via the service-role client — no client ever SELECTs them (RLS below
-- still scopes the row to the owner for the status fields).
-- ─────────────────────────────────────────────────────────────

create table if not exists google_connections (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  google_sub              text not null,        -- Google account id (detect "connected a different account")
  scope                   text not null,        -- granted scopes (space-delimited)
  refresh_token_enc       text not null,        -- base64 AES-256-GCM ciphertext
  refresh_token_iv        text not null,        -- base64 12-byte nonce
  refresh_token_tag       text not null,        -- base64 16-byte GCM auth tag
  access_token_expires_at timestamptz,
  status                  text not null default 'active'
                            check (status in ('active', 'needs_reauth', 'revoked')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table google_connections enable row level security;

-- The owner may read their own connection row (for status/scope display).
-- Writes happen only through the service-role client server-side.
create policy "own google connection" on google_connections
  for select using (auth.uid() = user_id);
