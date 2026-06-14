# easygas

AI coding IDE in the browser, specialized for **Google Apps Script** — chat with AI to build a tool,
preview it live, and deploy it to **your own Google account** with one click (via the Apps Script REST
API — no clasp on the server).

Stack: **Next.js 15** (App Router) · **Supabase** (Auth + Postgres + RLS) · **Anthropic** (Sonnet 4.6 / Opus 4.8) · Apps Script REST API.

> **You are at Phase 0 — the de-risking spike.** It proves the critical chain end-to-end before any AI/editor
> is built: `login → connect Google → encrypted refresh token → Apps Script create/push/deploy → live /exec URL`.
> See [docs/BUILDPLAN.md](docs/BUILDPLAN.md) for the full architecture and roadmap (Phases 0–8).

---

## Phase 0 setup

### 1. Install

```bash
npm install
```

### 2. Provision Supabase

1. Create a Supabase project. Copy the URL + anon key + service-role key into `.env`.
2. Run both migrations (SQL editor, in order):
   - `supabase/migrations/20260613000000_baseline.sql`
   - `supabase/migrations/20260613000100_google_connections.sql`
3. Enable **Email** auth (it's on by default). For the spike you can disable "Confirm email"
   (Authentication → Providers → Email) so sign-up logs you in immediately.

### 3. Provision Google Cloud (GCP)

> ⚠️ **Create the consent screen as a _Production_ app, NOT _Testing_.** In Testing mode, refresh tokens
> for External apps **expire after 7 days**, which breaks "push forever". Production removes that.

1. Create a GCP project (suggestion: `easygas-dev` now; a separate `easygas-prod` before launch).
2. **Enable APIs**: Apps Script API, Google Drive API, Google Sheets API.
3. **OAuth consent screen**: External · publish to **Production** · register the sensitive scopes:
   `.../auth/script.projects`, `.../auth/script.deployments`, `.../auth/drive.file` (+ `openid`, `email`).
4. **Credentials → OAuth 2.0 Client ID** (type **Web application**). Add an **Authorized redirect URI**
   that EXACTLY matches your `.env`:
   `http://localhost:3000/api/auth/google/callback`
   (this is *our* callback, not Supabase's). Copy the client id + secret into `.env`.

### 4. Generate the encryption key

```bash
npm run keygen          # prints a base64 32-byte key → paste into APP_ENCRYPTION_KEY
```

### 5. Fill `.env`

```bash
cp .env.example .env    # then fill every value (see comments in the file)
```

### 6. Run

```bash
npm run dev
```

---

## Manual test (what "PASS" looks like)

1. Open `http://localhost:3000/login` → sign up / sign in (Supabase identity).
2. Go to `/connect` → **เชื่อมต่อ Google**. On the consent screen (unverified app):
   **Advanced → Go to easygas (unsafe)** → accept the scopes.
3. Back at `/connect/done` → click **🚀 Deploy ตัวอย่าง**.
4. If you see **"ต้องเปิด Apps Script API ก่อน"**: open
   [script.google.com/home/usersettings](https://script.google.com/home/usersettings), toggle
   **Google Apps Script API = On**, then click **ลองอีกครั้ง**. *(This per-user wall is unavoidable —
   no scope bypasses it. The real product wraps it in onboarding.)*
5. ✅ **PASS** when you get an `/exec` link that opens to **"easygas works 🎉"**.

### Verify the important invariants
- In Supabase, `google_connections.refresh_token_enc` is **base64 ciphertext, not plaintext**.
- `egs_deployments` has a row with the `deployment_id` + `exec_url`.
- **Refresh works**: deploy again later (or after the access token would have expired) — it must succeed
  **without re-consent**. If you hit `NEEDS_REAUTH` / `invalid_grant`, your consent screen is still in
  **Testing** (7-day expiry) — flip it to **Production**.

---

## What's deliberately NOT here yet
No AI, no Monaco editor, no live preview. Those are Phases 1–6. Phase 0 only proves the deploy chain so
everything built afterward stands on a verified foundation. Roadmap: [docs/BUILDPLAN.md](docs/BUILDPLAN.md).
