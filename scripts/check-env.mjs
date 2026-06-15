#!/usr/bin/env node
/**
 * Pre-deploy environment check for EasyGAS.
 *
 *   npm run check:env
 *
 * Reads process.env (Railway injects these). For local convenience it also loads a
 * .env / .env.local file if present — real env vars always win. Exits non-zero when a
 * REQUIRED var is missing or malformed, so you catch a misconfigured deploy before it
 * 500s at runtime. Optional vars only print a warning.
 *
 * Zero dependencies on purpose — runs anywhere Node runs.
 */
import { readFileSync, existsSync } from "node:fs";
import { Buffer } from "node:buffer";

// ── tiny .env loader (no dependency) ──
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const env = process.env;
const has = (k) => typeof env[k] === "string" && env[k].trim() !== "";

const REQUIRED = [
  ["NEXT_PUBLIC_SUPABASE_URL", "Supabase project URL"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase anon key"],
  ["SUPABASE_SERVICE_ROLE_KEY", "Supabase service-role key (server-only)"],
  ["GOOGLE_OAUTH_CLIENT_ID", "Google OAuth client id"],
  ["GOOGLE_OAUTH_CLIENT_SECRET", "Google OAuth client secret"],
  ["GOOGLE_OAUTH_REDIRECT_URI", "OAuth callback URL (must match the GCP client)"],
  ["APP_ENCRYPTION_KEY", "AES-256-GCM key for token encryption"],
  ["ANTHROPIC_API_KEY", "Claude API key (default provider arm)"],
  ["SUPERADMIN_EMAILS", "comma-separated /admin allowlist"],
];

// Optional, but warn so you notice what's off.
const OPTIONAL = [
  ["OPENAI_API_KEY", "needed only for the 'chatgpt' arm"],
  ["DEEPSEEK_API_KEY", "needed only for the 'deepseek' arm"],
  ["GEMINI_API_KEY", "needed only for the 'gemini' arm"],
  ["TELEGRAM_BOT_TOKEN", "problem-report notifications (else stored in DB only)"],
  ["TELEGRAM_CHAT_ID", "problem-report notifications target chat"],
  ["BETA_MODE", "unset/any value = closed beta; 'off' = open to everyone"],
  ["EASYGAS_DAILY_LIMIT", "fallback daily cap (live value lives in /admin)"],
];

const errors = [];
const warnings = [];

for (const [key, why] of REQUIRED) {
  if (!has(key)) errors.push(`missing ${key} — ${why}`);
}

// APP_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).
if (has("APP_ENCRYPTION_KEY")) {
  try {
    const len = Buffer.from(env.APP_ENCRYPTION_KEY, "base64").length;
    if (len !== 32)
      errors.push(`APP_ENCRYPTION_KEY decodes to ${len} bytes, expected 32 (run: npm run keygen)`);
  } catch {
    errors.push("APP_ENCRYPTION_KEY is not valid base64 (run: npm run keygen)");
  }
}

// Redirect URI sanity: must be https + not localhost in a real deploy.
if (has("GOOGLE_OAUTH_REDIRECT_URI")) {
  const uri = env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!uri.endsWith("/api/auth/google/callback"))
    warnings.push(`GOOGLE_OAUTH_REDIRECT_URI should end with /api/auth/google/callback (got: ${uri})`);
  if (/localhost|127\.0\.0\.1/.test(uri))
    warnings.push("GOOGLE_OAUTH_REDIRECT_URI points at localhost — fine for dev, change it for prod");
  else if (!uri.startsWith("https://"))
    warnings.push("GOOGLE_OAUTH_REDIRECT_URI is not https:// — prod OAuth requires https");
}

for (const [key, why] of OPTIONAL) {
  if (!has(key)) warnings.push(`(optional) ${key} not set — ${why}`);
}

// ── report (color only on a real terminal; clean text when piped/CI) ──
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : `${s}`);
const ok = paint(32);
const warn = paint(33);
const bad = paint(31);

console.log("\nEasyGAS environment check\n" + "─".repeat(28));
for (const [key] of REQUIRED) console.log(`${has(key) ? ok("✓") : bad("✗")}  ${key}`);

if (warnings.length) {
  console.log("\n" + warn("warnings:"));
  for (const w of warnings) console.log(`  ${warn("!")} ${w}`);
}

if (errors.length) {
  console.log("\n" + bad(`✗ ${errors.length} problem(s) — not ready to deploy:`));
  for (const e of errors) console.log(`  ${bad("•")} ${e}`);
  console.log("");
  process.exit(1);
}

console.log("\n" + ok("✓ all required variables present — ready to deploy") + "\n");
