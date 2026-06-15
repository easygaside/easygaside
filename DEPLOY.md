# Deploying EasyGAS (Railway)

EasyGAS runs as a **long-lived Node container**, not serverless. The agent endpoint
(`/api/agent/[id]`) is an SSE stream that can run for minutes (tool loop + critic + up to 6
repair rounds), so it needs a host with **no per-request timeout**. Railway fits; Vercel's
serverless function timeouts would cut the stream off mid-run.

This repo is deploy-ready: [`railway.json`](railway.json) (build/start/healthcheck),
[`/api/health`](app/api/health/route.ts) liveness probe, Node pinned via [`.nvmrc`](.nvmrc),
and `npm run check:env` to validate config before you ship.

---

## 1. Provision the prod Supabase

You can reuse the existing Supabase project or create a fresh prod one. Either way, make sure
**every migration is applied** (in order) under `supabase/migrations/` — including the beta /
A-B-experiment tables: `egs_app_settings`, `egs_provider_config`, `egs_beta_allowlist`,
`egs_agent_runs`, `egs_generations`, `egs_reports`, `egs_user_settings`.

> If you're unsure what's applied, compare `supabase/migrations/` against the project's
> migration history before launch.

## 2. Set up Google Cloud (Testing mode for the closed beta)

Sign in to [console.cloud.google.com](https://console.cloud.google.com) with the **brand
account `easygaside@gmail.com`** (keeps the OAuth support email + privacy/terms contact
consistent, and avoids a painful migration later).

1. **Create a GCP project** (e.g. `easygas-prod`). It's free — no billing card needed for OAuth.
2. **Enable APIs**: Apps Script API, Google Drive API, Google Sheets API.
3. **OAuth consent screen** → **External**, leave it in **Testing**:
   - App name `EasyGAS`, support email `easygaside@gmail.com`.
   - App home page = your prod URL, **Privacy policy** = `https://<domain>/privacy`,
     **Terms** = `https://<domain>/terms`.
   - Register the sensitive scopes: `script.projects`, `script.deployments`, `drive.file`
     (+ `openid`, `email`).
   - **Add test users** — up to 100 emails (the same people you put in the beta allowlist).
4. **Credentials → OAuth 2.0 Client ID** (Web application). Add the **Authorized redirect URI**
   that EXACTLY matches `GOOGLE_OAUTH_REDIRECT_URI`:
   `https://<your-domain>/api/auth/google/callback`
   Copy the client id + secret into the env vars below.

> **Testing vs Production.** The closed beta runs in **Testing mode** — no Google verification
> needed, ≤100 users. The trade-off: External-app refresh tokens **expire after 7 days**, so
> testers re-click "เชื่อมต่อ Google" weekly. To remove that (and go past 100 users) you publish
> to **Production** and pass Google's OAuth verification — for our **sensitive** scopes that means
> consent-screen review + domain ownership + a demo video, but **no CASA security audit** (CASA is
> only for *restricted* scopes; `drive.file` keeps us out of it). The Phase-0 note in `README.md`
> that says "Production, not Testing" predates this beta plan — Testing mode is correct for launch.

## 3. Deploy to Railway

1. [railway.com](https://railway.com) → **New Project → Deploy from GitHub repo** (or
   `railway up` from the CLI). Nixpacks auto-detects Next.js and uses `railway.json`.
2. Add the env vars (next section).
3. Railway gives you a `*.up.railway.app` domain. Put it (or your custom domain) into
   `GOOGLE_OAUTH_REDIRECT_URI` **and** the GCP Authorized redirect URI — they must match exactly.
4. The healthcheck hits `/api/health`; the deploy goes live once it returns 200.

## 4. Environment variables (set in Railway → Variables)

Run `npm run check:env` locally first — it flags anything missing or malformed.

**Required**

| Var | Notes |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only; reads encrypted token columns |
| `GOOGLE_OAUTH_CLIENT_ID` | from GCP |
| `GOOGLE_OAUTH_CLIENT_SECRET` | from GCP (server-only) |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://<domain>/api/auth/google/callback` — must match GCP |
| `APP_ENCRYPTION_KEY` | base64 32-byte key — `npm run keygen` |
| `ANTHROPIC_API_KEY` | Claude — the default provider arm |
| `SUPERADMIN_EMAILS` | comma-separated; who can open `/admin` |

**Optional**

| Var | When you need it |
|-----|------------------|
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `GEMINI_API_KEY` | only for those A/B arms |
| `OPENAI_MODEL` / `DEEPSEEK_MODEL` / `GEMINI_MODEL` | override the default model id (also editable in `/admin`) |
| `BETA_MODE` | unset / any value = closed beta (allowlist enforced); `off` = open to everyone |
| `EASYGAS_DAILY_LIMIT` | fallback per-user daily cap; the live value lives in `/admin` |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | problem-report pings (else reports just sit in `egs_reports`) |
| `SUPABASE_URL` | server-only copy of the URL (falls back to the public one) |

## 5. Seed the closed beta

```sql
insert into egs_beta_allowlist (email) values
  ('tester1@gmail.com'), ('tester2@gmail.com'); -- ...all 30, matching the GCP test users
```

Then open `/admin` and **auto-balance the arms** to split the 30 testers across
claude / deepseek / chatgpt (10 each). Set per-provider model ids and the daily limit there too.

## 6. Smoke test (after the deploy is live)

- [ ] `GET /api/health` → `{"status":"ok"}`
- [ ] Security headers present (`curl -sI https://<domain>` → `X-Frame-Options`, HSTS, etc.)
- [ ] Login with Google → consent screen shows EasyGAS + the privacy/terms links → accept
- [ ] Create a project, send a chat turn, watch the SSE stream run to completion (no timeout cut-off)
- [ ] Deploy a generated tool → `/exec` URL opens
- [ ] **Each A/B arm once** — claude is proven, but chatgpt / deepseek / gemini have not been run
      live yet; create one test project per provider before handing arms to real testers
- [ ] Submit a problem report → it lands in `egs_reports` (and Telegram if configured)

## 7. After live testing

- Flip CSP from observe to enforce: in [`middleware.ts`](middleware.ts) rename the header
  `Content-Security-Policy-Report-Only` → `Content-Security-Policy` once the browser console
  shows no CSP violations from Monaco / the preview iframe.
