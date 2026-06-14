# easygas — WEB-TARGET: static hosting สำหรับงานกล้อง/เว็บจริง (Vercel-like)

> สร้างจาก research workflow (2026-06-14). target ที่ 2 ต่อจาก GAS — แก้ปัญหา GAS บล็อกกล้อง/โดเมน/Realtime
> เกี่ยวข้อง: [[BUILDPLAN.md]] §J · [[QUALITY-MOAT.md]] · lib/deploy.ts (GAS target แรก) · lib/deployment-targets/ (ยังไม่สร้าง)

---

## TL;DR RECOMMENDATION

- **Camera and modern web apps cannot run inside Google Apps Script — it is structural, not a bug.** GAS wraps your HTML in a cross-origin sandboxed iframe whose parent `allow=` attribute Google controls and does **not** include `camera`/`microphone`, so `getUserMedia()` is permanently blocked. Google's own forum told users to move camera code off GAS (Issue Tracker 486623612). The only fix is serving the app from **our own origin**.
- **Ship the camera/modern tier as a real static SPA on Cloudflare, with Supabase as the default backend.** Supabase is the only data option giving real CORS, real auth, row-level security with a browser-safe `anon` key, and native photo Storage — exactly what camera apps need.
- **Host platform = Cloudflare, one Worker as the tenant router (Static Assets + KV/R2), plus Cloudflare for SaaS for custom domains.** Cost scales with *traffic and custom domains*, not with the number of tenants/deploys/builds — the opposite of Netlify (per-deploy credits) and Pages (100-project wall).
- **MVP runs at ≈ $5–25/mo all-in.** Static-asset requests are free/unlimited; Workers Paid is $5/mo for 10M requests; BYO custom domains are free for the first 100, then $0.10/domain/mo. Defer Workers for Platforms ($25/mo) until tenants need to run server code.
- **This plugs in as an adapter, not a core rewrite.** The codebase has no `DeploymentTarget` interface yet (GAS is hard-coded inline in `lib/deploy.ts` + `lib/gas-script-api.ts`); BUILDPLAN §J.5/§J.6 says: define the interface, route current GAS through a `GASAdapter`, add `target`/`spec` to `egs_projects`, and register web as a new adapter.
- **Sell legitimacy, not bandwidth.** Thai SMBs pay for own-domain + remove-branding + commercial-use rights, billed in THB via PromptPay/LINE Pay. Price Starter as a ฿149 impulse buy; push annual prepay for retention.
- **Phase it:** MVP = Free subdomain + Starter (custom domain + no badge) on one Cloudflare Worker. Don't build WebContainer, multi-target registry, or run-and-repair until demand is proven (YAGNI per §J.6).

---

## 1. Problem — GAS camera & modern-API limits

The current easygas product deploys generated apps as **Google Apps Script (GAS) web apps** (single-target pipeline in `F:\SaaS\easygas\lib\deploy.ts` → `deployProject`). That target has a hard structural ceiling that blocks an entire class of apps non-coders want to build: **camera apps, real-time apps, and anything needing npm packages or a custom domain.**

### 1.1 The camera is blocked — and it is not fixable from inside GAS

A GAS HTML-Service web app does **not** run at `script.google.com` directly. Google wraps your HTML in a **cross-origin sandboxed `<iframe>`** (the only surviving sandbox mode is `IFRAME`). `getUserMedia()` — the API behind every web camera — has two independent gates:

1. **Secure context (HTTPS).** GAS passes this. ✅
2. **Sandbox + Permissions Policy.** GAS **fails** this. Per MDN:
   - *"A document loaded into a sandboxed `<iframe>` cannot call `getUserMedia()` unless the `<iframe>` has its `sandbox` attribute set to `allow-same-origin`."*
   - *"The two Permissions Policy directives that apply to `getUserMedia()` are `camera` and `microphone`."* A cross-origin iframe needs the **parent** to grant them via `allow="camera; microphone"`.

The GAS `IFRAME` sandbox includes `allow-same-origin` and `allow-scripts`, **but you do not control the parent frame's `allow=` attribute, and Google does not put `camera`/`microphone` in it.** The browser refuses the camera. This is exactly what users hit (Feb 2026):

```
[Violation] Permissions policy violation: camera is not allowed in this document.
NotAllowedError: Permission denied
```

Google's own developer forum confirmed the cause — *"The iframe sandbox does not include 'camera' permissions"* — and the official recommendation was to **move scanner/camera code off Apps Script onto a self-controlled domain** (Issue Tracker 486623612 / 486922850). Because the `allow` attribute lives on Google's parent frame, **there is no in-GAS workaround.**

> Sources: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) · [Apps Script HTML restrictions](https://developers.google.com/apps-script/guides/html/restrictions) · [Google Dev forum: Camera Permission in web app](https://discuss.google.dev/t/camera-permission-in-web-app/333827) · [addpipe: camera in cross-origin iframes](https://blog.addpipe.com/camera-and-microphone-access-in-cross-oirigin-iframes-with-feature-policy/)

### 1.2 The other GAS ceilings

The same sandbox/identity model that blocks the camera also blocks:

- **No live camera / no Realtime** — no WebSocket, no streaming.
- **No npm packages** — single `.gs` runtime, no bundler.
- **No custom domain / no public SEO** — you get a `script.google.com/.../exec` URL, force-redirected through a one-time `script.googleusercontent.com` URL.
- **Brittle data access from a browser SPA** (see §4): GAS `ContentService` returns **no `Access-Control-Allow-Origin` header**, has **no `setHeaders()`**, runs **no real `doOptions`** preflight handler, and **force-redirects (302)** to a one-time URL you don't control. The only browser-workable patterns are **JSONP (GET)** and a **`text/plain` simple-request POST** — neither is a real backend.
- **Owner-identity + no row-level security** — anonymous deployment must run *Execute as me*, so every call touches the owner's Sheets under one identity, with only a hand-rolled shared secret for auth.

**GAS stays excellent** for internal Workspace tools: Sheets/Drive/Gmail data, zero hosting cost, single-file, still-photo capture via `<input capture>`. The goal is **not to replace GAS** — it's to add a second target for the apps GAS structurally cannot serve.

---

## 2. Architecture — static SPA host + data backend

The fix is the same for every modern/camera app: **serve the SPA from our own origin** (top-level, HTTPS, not a sandboxed third-party iframe), where `getUserMedia()` and everything else works normally. The SPA then talks to a **data backend**. We support two data paths.

### Path A — GAS-as-JSON-API (legacy / keep-the-Sheet)

The SPA is served from our origin, but data still lives in the user's existing GAS + Google Sheet, exposed via `doGet`/`doPost` → JSON and called with `fetch()`. This keeps the Sheet-as-database for write-mostly logging — but it inherits every CORS constraint in §4 and has **no real auth, no row security, no Realtime, painful photo handling**.

```
   ┌─────────────────────────────────────────────┐
   │  Static SPA on OUR origin (Cloudflare, HTTPS)│
   │  getUserMedia() works — top-level, not iframe │
   └───────────────┬─────────────────────────────┘
                   │  fetch()  — CORS-constrained:
                   │   • GET  → JSONP via <script> only
                   │   • POST → Content-Type: text/plain
                   │            (skips preflight), body =
                   │            JSON.stringify(...), redirect:"follow"
                   ▼
   ┌─────────────────────────────────────────────┐
   │  User's GAS Web App  (doGet / doPost → JSON) │
   │  Deploy: Anyone-anonymous + Execute-as-me    │
   │  302 → one-time script.googleusercontent.com │
   │  Auth = hand-rolled shared secret only       │
   └───────────────┬─────────────────────────────┘
                   ▼
         ┌───────────────────┐
         │  Google Sheet     │  (single owner identity, no RLS)
         └───────────────────┘
```

**Use only for:** tiny write-mostly logging where the Sheet must stay. Never for a real camera product.

### Path B — Supabase (DEFAULT for camera / modern apps) ✅

The SPA is served from our origin and talks to **Supabase** (managed Postgres + PostgREST auto-API + GoTrue Auth + Storage + Edge Functions + Realtime) over **proper CORS-enabled HTTPS** — no `text/plain` hacks, no double 302.

```
   ┌─────────────────────────────────────────────┐
   │  Static SPA on OUR origin (Cloudflare, HTTPS)│
   │  getUserMedia() captures photo (top-level)   │
   └───────────────┬─────────────────────────────┘
                   │  supabase-js  (publishable / anon key — SAFE in browser,
                   │                because RLS enforces per-row access)
                   ▼
   ┌─────────────────────────────────────────────┐
   │                  SUPABASE                     │
   │  ┌────────────┐  GoTrue Auth → JWT held client-side
   │  │  Auth      │
   │  ├────────────┤  Postgres + RLS  → implicit WHERE = only this user's rows
   │  │  Postgres  │
   │  ├────────────┤  Storage (RLS)   → camera photos / scans, direct upload
   │  │  Storage   │
   │  ├────────────┤  Edge Functions (Deno) → service_role work, 3rd-party
   │  │  Edge Fn   │     APIs, server secrets — NEVER in the browser
   │  ├────────────┤
   │  │  Realtime  │  → live updates
   │  └────────────┘
   └─────────────────────────────────────────────┘
```

**Why the `anon` key is safe** (the core difference vs Path A and the Sheets-API path): *"The anon key is safe for client use because RLS and policies protect your data."* Row-Level Security adds an implicit `WHERE` to every query, enforcing per-user/per-row authorization with a **publicly shippable** key. The `service_role` key has `BYPASSRLS` and lives **only** server-side / in Edge Functions. Unlike a Google OAuth token (all-or-nothing) or a GAS owner-identity deployment, Supabase gives **per-row authorization out of the box** plus first-class **binary photo Storage** and **Realtime**.

> Sources: [Apps Script Content Service](https://developers.google.com/apps-script/guides/content) · [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys) · [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Supabase Edge Functions](https://supabase.com/docs/guides/functions) · [Supabase: securing data](https://supabase.com/docs/guides/database/secure-data)

### A third, narrow option: Google Sheets API v4 from the browser

An API key in the browser **only grants read-only access to public data** — acceptable for a **public read-only dashboard** (lock the key by HTTP-referrer + restrict to the Sheets API). **Never** ship a writable Google credential: writes need OAuth, a browser token is exposable, and a Sheet has **no row-level security** — a token that can write one row can rewrite the whole sheet. No camera/photo story. Use for public read-only display only.

---

## 3. Hosting platform decision — Cloudflare (one Worker router)

**Recommendation: Cloudflare.** A **single Worker** (Static Assets + KV/R2) acts as the tenant router; **Cloudflare for SaaS Custom Hostnames** handles bring-your-own domains. Add **Workers for Platforms ($25/mo)** only if/when tenants need to run real per-tenant server code.

### Why the shape of the problem forces this

Three requirements collapse the option space:

1. **`{slug}.easygas.app` per tenant** — one wildcard DNS record + one wildcard TLS cert on a domain *we* own. Easy anywhere.
2. **BYO custom domain (`shop.tenant.com`)** — each needs its own auto-issued/auto-renewed TLS cert. This is the hard part, and exactly what "domains-for-SaaS" products automate.
3. **Hundreds of *tiny* sites** — the cost model must be **per-request / per-domain**, not per-project / per-seat / per-build.

### How the platforms compare

| | Programmatic multi-tenant deploy | `{slug}.app` wildcard | BYO custom-domain automation | Cost shape at 100s of tiny tenants | Fit |
|---|---|---|---|---|---|
| **CF Workers + for SaaS** | Object write to KV/R2 (no build step) | 1 wildcard route, free | **API-driven auto-SSL, $0.10/domain** | Per-request + per-domain (linear, cheap) | **Best** |
| **CF Workers for Platforms** | Upload script per tenant via API | same | same Custom Hostnames | $25 base, **1,000 tenants incl.** | Best **if tenants run code** |
| CF Pages | Direct Upload API, **per-project** | per-project | per-project, no SaaS layer | **100-project wall** | Poor for fan-out |
| GitHub Pages | one-site-per-repo | **no wildcard** | manual, no API | 1 GB/site, ToS bars commercial hosting | **Disqualified** |
| Netlify | great API, **per-site** | per-site | auto-SSL, no SaaS wildcard layer | **per-deploy + per-GB credits** | Wrong cost shape |
| Roll-your-own (R2/S3) | full control | DIY router | **DIY ACME / on-demand TLS** (hard) | cheap storage, high eng cost | Only at large scale |

### Why Cloudflare wins, decisively

1. **Right cost shape.** Static-asset requests are **free/unlimited**; you pay per Worker invocation (~$5/mo for 10M, then $0.30/M) and **$0.10/BYO-domain** above 100 free. Cost grows with traffic and custom domains — **not** with tenants, deploys, builds, or seats. The exact opposite of Netlify's credit model (a production deploy costs ~15 credits ≈ $0.10 — brutal when non-coders republish constantly) and Pages' per-project limits.
2. **BYO domains are a solved API, not a DIY ACME project.** Call **Create Custom Hostname** → customer points a **CNAME** at our zone → Cloudflare auto-issues and auto-renews TLS (DCV). 300 BYO-domain tenants ≈ (300−100) × $0.10 = **$20/mo total**. (Caveat: true `*.tenant.com` wildcard SANs are Enterprise-only — irrelevant, BYO domains are added one at a time.)
3. **One router, not N projects.** A slug is a **KV/R2 key**, not a project — so we sidestep Pages' 100-project cap and GitHub's one-site-per-repo entirely.
4. **Clear upgrade path** to per-tenant code (Workers for Platforms: $25/mo base, 20M requests + 1,000 scripts included, then $0.02/extra script) with no re-platforming.

**Pages is the obvious-but-wrong choice** here: great for *our* marketing site/admin, bad as the tenant fan-out substrate (project-centric, 100-project soft cap, per-build limits). **GitHub Pages is disqualified** — no wildcard, one-site-per-repo, and its ToS states it is *"not intended for… commercial hosting."*

### Cheapest viable MVP path (≈ $5–25/mo all-in)

1. Register `easygas.app`; add to Cloudflare; create wildcard DNS `*.easygas.app` + wildcard TLS (free, our own zone).
2. One Worker on route `*.easygas.app/*`: parse slug → look up tenant in **KV** → stream the built site from **R2** (free tier: 10 GB + 1M Class-A + 10M Class-B ops covers the first dozens of tenants; R2 egress is **$0**).
3. "Deploy" from the browser IDE = **write the tenant's built files to R2 + a KV record.** No build queue, no per-tenant project, instant publish.
4. BYO domains: enable **Cloudflare for SaaS**; on attach, call Create Custom Hostname, show the customer the CNAME, poll for cert issuance. First **100 domains free**, then $0.10 each.
5. Stay on **Workers Paid ($5/mo)**; defer **Workers for Platforms ($25/mo)** until tenants demonstrably need to execute code.

> Keep abuse-prone free subdomains on a **sacrificial apex** (e.g. `*.easygas-sites.app`) so a Safe-Browsing blocklist can't poison paid custom domains (see §7).
>
> Sources: [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) · [KV routing example](https://developers.cloudflare.com/kv/examples/routing-with-workers-kv/) · [Cloudflare for SaaS plans/pricing](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/) · [Create custom hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/create-custom-hostnames/) · [Workers for Platforms pricing](https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/reference/pricing/) · [R2 pricing](https://developers.cloudflare.com/r2/pricing) · [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Netlify credits model](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)

---

## 4. Camera-app reference flow (step by step)

This is the canonical flow for a non-coder's camera app (e.g. "snap a photo of a delivery, log it"), on **Path B (Supabase)**:

1. **Serve the SPA from our origin.** Cloudflare Worker resolves `{slug}.easygas.app` → streams the built static SPA from R2. The page is **top-level HTTPS, not a GAS iframe**, so the browser will grant camera permission.
2. **Capture.** SPA calls `getUserMedia({ video: true })` → renders the live preview → grabs a still frame to a `Blob`/`File`. (Works because §1's permissions-policy block does not apply on our own origin.)
3. **Authenticate.** SPA initializes `supabase-js` with the **publishable/anon key** (safe in browser). User signs in via **GoTrue** (email/OTP/OAuth/anonymous) → JWT is held client-side.
4. **Upload the photo.** Photo blob → **Supabase Storage** bucket via direct browser upload. **Storage RLS policies** gate who can write/read which paths (e.g. `userId/...`).
5. **Write metadata.** Insert the row (photo path, timestamp, slug, fields) into Postgres via PostgREST. **RLS auto-adds a `WHERE`** so the user can only see/write their own rows — enforced by the database, not the client.
6. **Heavy / secret work → Edge Function.** Anything needing the `service_role` key, image processing, or a paid third-party API call runs in a **Deno Edge Function** — never shipped to the browser.
7. **Live updates (optional).** Subscribe via **Supabase Realtime** to reflect new rows instantly (e.g. a shared log updating across devices).

**Why each GAS path fails this flow** (for contrast):
- *GET back the data* → GAS sends no `Access-Control-Allow-Origin`; only **JSONP via `<script>`** works (GET-only, no error handling, XSS footgun).
- *POST JSON* → `application/json` triggers a **preflight `OPTIONS`**, which GAS has **no handler** for → blocked. Workaround: `Content-Type: text/plain;charset=utf-8` (a CORS "simple request" that skips preflight) with `JSON.stringify(body)` read server-side via `e.postData.contents`, and `redirect:"follow"` to chase the **302 → one-time `script.googleusercontent.com`** URL. Practically write-only and brittle.
- *Photo storage* → base64 into a cell or Drive; no real binary story.

---

## 5. How it plugs into the pluggable DeploymentTarget

### Current reality (verified in the codebase)

There is **no `DeploymentTarget` interface today.** All GAS operations are **hard-coded inline**:
- `F:\SaaS\easygas\lib\deploy.ts` (`deployProject`, lines 40–103) — the linear single-target pipeline: build files → fetch OAuth token → ensure script exists → `updateContent()` + `createVersion()` → PATCH-or-create deployment → return `execUrl`/`scriptId`.
- `F:\SaaS\easygas\lib\gas-script-api.ts` — `createProject` / `updateContent` / `createVersion` / `createDeployment` / `updateDeployment`.
- Entry point `F:\SaaS\easygas\app\api\deploy\[id]\route.ts` (POST → `deployProject()`).

The interface exists **only as a spec in BUILDPLAN §J.5** (pseudo-code, lines 326–341). The **real** target-agnostic interface to cite:

```ts
interface DeploymentTarget {
  id: 'gas' | 'web-supabase';        // + 'static-web' for this work
  capabilities: CapabilitySet;
  requiredScopes: AuthScope[];
  // Codegen
  systemPrompt(spec): string;
  rulebook(): string;
  modelRoute(stage): ModelId;
  // File format
  scaffold(spec): FileTree;
  serialize(tree): GasFile[];
  manifest(spec): string;
  // Gate 1 lint
  lint(tree): LintResult[];
  // Preview
  preview(tree): PreviewUrl;
  // Gate 3 (run-and-repair)
  push(tree, account): void;
  run(scratch, entry): ExecutionResult;
  captureError(res): ErrorSignature;
  // Final deploy
  deploy(tree, account): DeploymentResult;
  deployedUrl(res): string;
}

type CapabilitySet = {
  liveCamera: boolean; stillPhoto: boolean; realtime: boolean;
  npmPackages: boolean; customDomain: boolean; publicSeo: boolean;
  workspaceData: boolean; zeroHosting: boolean; backgroundJobs: boolean;
}
```

The **capability router** (§J.3) is a **pure function** `routeTarget(spec) → {target, confidence, reasons[], fallbackOption?}`. Signals routing to **web**: `liveCamera`, `realtime`, `npmPackages`, `customDomain`, `publicSeo`. Stay on **GAS**: `workspaceData` + zero hosting + internal tool + no web signals. Special case: **`camera & liveStreamRequired` → web; `camera & singlePhoto` → GAS** still-photo via `<input capture>`.

### Where the static-web / Supabase target plugs in

Per §J.6 ("don't over-engineer"), this is **adapter registration, not a core rewrite**:

1. **Define the interface (NEW)** — `lib/deployment-targets/types.ts` (`DeploymentTarget` + `CapabilitySet` exactly as above).
2. **Refactor current GAS → `GASAdapter` (REFACTOR)** — move `deploy.ts`/`gas-script-api.ts` logic behind `gasAdapter: DeploymentTarget` (`push()` = `updateContent()`, `deploy()` = today's `deployProject()` flow). Capabilities: `{ liveCamera:false, stillPhoto:true, realtime:false, npmPackages:false, customDomain:false, workspaceData:true, zeroHosting:true }`.
3. **Routing layer (NEW)** — `lib/deployment-targets/index.ts`:
   ```ts
   export function getTarget(id: string): DeploymentTarget {
     return deploymentTargets[id] ?? gasAdapter; // default 'gas'
   }
   ```
4. **Update the API route (REFACTOR)** — `app/api/deploy/[id]/route.ts`:
   ```ts
   const target = getTarget(project.target ?? 'gas');
   const result = await target.deploy(tree, account);
   ```
5. **Schema (REFACTOR DB)** — `egs_projects` has **no `target`/`spec` today**:
   ```sql
   ALTER TABLE egs_projects ADD COLUMN target TEXT DEFAULT 'gas';
   ALTER TABLE egs_projects ADD COLUMN spec   JSONB;
   ```
6. **Implement the web adapter (NEW)** — `lib/deployment-targets/static-web-adapter.ts` (or `web-supabase-adapter.ts`). Capabilities: `{ liveCamera:true, stillPhoto:true, realtime:true, npmPackages:true, customDomain:true, publicSeo:true, zeroHosting:false }`. `deploy()` = **write built files to R2 + KV record** (Cloudflare router from §3), optionally provision Supabase. `captureError()` = parse build/network errors from the host response.

**Net commitment (verbatim from §J.6):** core speaks target via the interface only + `spec` carries `target` + `capabilityNeeds` + router is a pure function → **web plugs in as adapter registration, not core rewrite.** Quality gates ride along: **Gate 2 (rulebook critic)** and **Gate 3 (run-and-repair, N≤3)** are **designed but NOT BUILT** (`QUALITY-MOAT.md`), so the web adapter only needs `lint()` + `deploy()` for MVP; tag flywheel/lint rules with `target` now to avoid expensive retrofits.

---

## 6. Monetization (hosting tier)

Hosting is a **separate, additive** product line from the existing **AI credits**: **credits = how you BUILD** (metered, variable), **hosting = how you SHIP & keep it live** (subscription, predictable). Free **fork stays free** — nothing here sells *apps*; we sell **uptime + domain + bandwidth**. Thai SMBs pay for **legitimacy** (own domain, no badge, commercial-use rights), not bandwidth, and pay in **THB via PromptPay/LINE Pay**.

THB priced for the local market; USD for reference (~33–35 THB/USD).

| | **Free (ฟรี)** | **Starter (เริ่มต้น)** | **Business (ธุรกิจ)** | **Pro / Multi (มืออาชีพ)** |
|---|---|---|---|---|
| **Monthly** | ฿0 | **฿149** (~$4.50) | **฿390** (~$11) | **฿990** (~$29) |
| **Annual (save ~2 mo)** | — | **฿1,490** (~$45) | **฿3,900** (~$118) | **฿9,900** (~$295) |
| **Domain** | `name.easygas.app` subdomain | **1 custom domain** + SSL | 1 custom domain + SSL | **up to 5 custom domains** + SSL |
| **Hosted live apps** | 1 | 1 | 3 | 10 |
| **Bandwidth (soft cap)** | 20 GB/mo | 100 GB/mo | 300 GB/mo | 1 TB/mo |
| **easygas badge** | Shown (required) | **Removed** | Removed | Removed |
| **Commercial use** | **No** (personal/test) | **Yes** | Yes | Yes |
| **Always-on / no sleep / no ads** | Best-effort, may sleep | Always-on | Always-on | Always-on |
| **Password / "coming soon" page** | — | — | Yes | Yes |
| **Support** | Community / docs | LINE (best-effort) | Priority LINE | Priority LINE + onboarding |
| **Billing** | — | PromptPay / LINE Pay / card | PromptPay / LINE Pay / card | PromptPay / LINE Pay / card |

**Rationale (benchmarked vs Vercel/Netlify/Cloudflare, verified June 2026):**
- The market monetizes **commercial use + custom domain + remove-branding + seats/projects — not raw bandwidth** (Cloudflare gives bandwidth away). The entry price the market settled on is **~$20/mo** = "this is a real business site."
- **Free is crippled for *commerce*, not for *trying*** — subdomain + badge + "no commercial use" mirrors **Vercel Hobby's non-commercial ToS line**, the single best conversion lever. The upgrade trigger is **emotional** (own domain + no badge), not a usage wall users resent.
- **Starter ฿149** is a Thai impulse price (below one lunch) — the volume tier, capturing "I just want my domain and no badge."
- **Bandwidth caps are soft** (warn, never hard-cut a paying customer) — a fair-use guardrail, not a metering revenue stream. Margin comes from the **subscription**, and from **annual PromptPay prepay** (Thai SMBs prefer one yearly payment over recurring card billing they distrust).
- **Cross-sell, no double-bill:** build with credits → naturally need to publish → hit the "custom domain / remove badge needs a hosting plan" wall. **Publishing/deploy itself costs 0 credits** — charging credits *and* a hosting fee for the same "go live" action blocks conversion. Hosting is the **recurring-MRR retention anchor** that spiky credits can't provide.

> Sources: [Vercel Free vs Pro 2026](https://www.fencode.dev/en/blog/vercel-free-vs-pro-2026-official-limits-pricing) · [Netlify Pricing April 2026](https://www.netlify.com/changelog/2026-04-14-pricing-updates-april-2026/) · [Cloudflare Pages pricing & limits 2026](https://www.devtoolreviews.com/reviews/cloudflare-pages-pricing-bandwidth-limits-2026) · [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)

---

## 7. Phased rollout + risks

### Rollout (don't build it all)

- **MVP** — Free subdomain + **Starter** (custom domain + remove badge) only, everything on **one Cloudflare Worker + KV/R2 + Cloudflare for SaaS**. On the codegen side: define `DeploymentTarget`, route GAS through `GASAdapter`, add `target`/`spec` columns, ship the **static-web/Supabase adapter** with `lint()` + `deploy()`. Captures ~80% of willingness-to-pay with minimal engineering. (Per §J.6, **do NOT** build WebContainer, Vercel/Netlify OAuth provisioning, a generic N-target registry, or cross-target migration yet — YAGNI.)
- **V2** — Add **Business** (multi-app + password-protect) once real demand for 2+ sites appears. Optionally add **Gate 2 critic / Gate 3 run-and-repair** (still unbuilt) for web quality.
- **V3** — **Pro/reseller** tier + registrar integration (sell domains in-app). Highest support payoff, most ops work — do it last.

### Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Camera still fails** because app is served from a wrapped iframe | Critical | Hard rule: camera/Realtime apps **must** route to the web target and be served **top-level from our origin** — never embed the SPA in any third-party iframe. Capability router gates this (`liveCamera → web`). |
| **Free-tier cost bleed** (bandwidth/storage on apps nobody pays for) | High | Static-only on Cloudflare → near-zero marginal cost (R2 egress $0, static-asset requests free). 20 GB free cap + **auto-sleep inactive free apps** (no traffic 30 days → unpublish, one-click restore). |
| **Phishing/scam content on free subdomains** poisons the apex (Safe Browsing blocklists *all* `*.easygas.app`) | **Critical** | **Sacrificial apex** for free sites (`*.easygas-sites.app`) so a blocklist can't poison paid custom domains. Automated content scan on publish, rapid takedown, abuse link, phone/LINE verify before a free site goes public. |
| **Support load from non-coders** (DNS, "why isn't my domain working") | High | **Automate DNS** — sell domains in-app (registrar API) so users never touch nameservers; for BYO, copy-paste records + "verify" button + Thai video. Live human LINE support gated to paid tiers only. |
| **Custom-domain SSL failures at scale** | Medium | Use **Cloudflare for SaaS** automatic ACME — never hand-manage certs. |
| **Supabase key/RLS misconfiguration** leaks data | High | `service_role` **never** in the browser (Edge Functions only); **default-deny RLS** on every table keyed to `auth.uid()`; Storage RLS on every bucket. Treat as a security-review gate before any web app ships. |
| **Free-tier abuse as a free CDN/file host** | Medium | Block non-web MIME types / large binaries on free; per-file + total-storage caps; the 20 GB cap throttles abuse. |
| **THB payment friction / churn** | Medium | PromptPay + LINE Pay first (cards distrusted); **push annual prepay** to cut churn and card-failure dunning. |
| **GAS↔Supabase migration breaks existing Sheet consumers** | Medium | Model schema (one table/tab, real types/PKs), CSV import, **default-deny RLS**, move `doPost` mutations into RPC/Edge Functions, optional **dual-run Supabase→Sheet sync** during transition, then repoint the SPA and retire the Sheet. |

**Bottom line:** GAS structurally cannot do camera/modern apps — add a second target that serves a real static SPA from **our own Cloudflare origin** with **Supabase** as the default backend. It plugs in as a **DeploymentTarget adapter, not a core rewrite**, runs at **≈ $5–25/mo** to launch, and monetizes by selling **legitimacy** (own domain + no badge + commercial use) to Thai SMBs via PromptPay — turning hosting into the recurring-MRR backbone that AI credits alone can't provide.
