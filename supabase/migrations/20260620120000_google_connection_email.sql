-- storeConnection()/getConnectionStatus() (lib/google-connection.ts) and the connect page write &
-- read a connected-Google email column, but the original google_connections migration never created
-- it. The missing column made every storeConnection() upsert fail ("column email does not exist"),
-- so the OAuth callback hit fail("store_failed") and no connection was ever persisted. Add it.
alter table google_connections add column if not exists email text;
