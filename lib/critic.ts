import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getFiles } from "@/lib/files";
import { getAppSetting } from "@/lib/settings";
import type { EgsProject } from "@/types/db";

/**
 * Gate 1 — rulebook critic (QUALITY-MOAT §2): a single cheap LLM-as-judge pass that catches
 * semantic best-practice violations the regex lint (gate 0, lib/gas-codegen.validateGasFiles)
 * structurally cannot. It is a pre-filter, NOT a "does it run" verdict — that is gate 2
 * (dynamic run-and-repair, deferred). The agent loop runs ONE bounded auto-repair from its output.
 */

// The critic is the SHARED quality yardstick for EVERY arm (one judge → critic_issues stays
// comparable across providers, and a fix to the rubric lifts all arms at once). It's an
// LLM-as-judge against a very prescriptive rubric, so a small/cheap model handles it well.
// Default = DeepSeek v4-flash: at ~$0.28/M output it's ~18× cheaper than Haiku, making the gate
// near-free — which is the whole point (keep the per-build overhead tiny so the energy tank stretches).
// Provider/model are superadmin-editable in /admin (egs_app_settings.critic_provider/critic_model);
// env (CRITIC_PROVIDER / CRITIC_MODEL) is the fallback when the DB rows are absent. Only claude and
// deepseek backends are implemented, so /admin constrains the choice to those two.
type CriticProvider = "deepseek" | "claude";
const CRITIC_PROVIDER_FALLBACK = ((process.env.CRITIC_PROVIDER as CriticProvider) || "deepseek") as CriticProvider;
const CRITIC_MODEL_FALLBACK = process.env.CRITIC_MODEL || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/** The stock model for a critic backend when no explicit model is configured. */
function defaultCriticModel(p: CriticProvider): string {
  // deepseek-chat = current GA, supports json mode. Deprecates 2026-07-24 → confirm DeepSeek's GA
  // replacement id and update before then. (Only a fallback; the live critic model is admin-set.)
  return p === "claude" ? "claude-haiku-4-5-20251001" : "deepseek-chat";
}

interface CriticConfig {
  provider: CriticProvider;
  model: string;
}

/** Resolve the active critic backend from DB (admin), falling back to env then stock defaults. */
async function resolveCritic(): Promise<CriticConfig> {
  const stored = (await getAppSetting("critic_provider")) as CriticProvider | null;
  const provider: CriticProvider =
    stored === "claude" || stored === "deepseek" ? stored : CRITIC_PROVIDER_FALLBACK;
  const model =
    (await getAppSetting("critic_model"))?.trim() || CRITIC_MODEL_FALLBACK || defaultCriticModel(provider);
  return { provider, model };
}
const CRITIC_MAX_TOKENS = 1500;
const MAX_ISSUES = 12; // bound the repair prompt

export type CriticSeverity = "high" | "medium" | "low";

export interface CriticIssue {
  file: string;
  /** 1-based line in `file` where the problem is (for editor highlighting); undefined if unknown. */
  line?: number;
  severity: CriticSeverity;
  problem: string;
  fix: string;
}

export interface CriticResult {
  ok: boolean;
  issues: CriticIssue[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

interface CriticUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

const EMPTY: CriticResult = {
  ok: true,
  issues: [],
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
};

const CRITIC_SYSTEM = `You are a senior Google Apps Script (GAS) reviewer. Review the project files for
correctness / best-practice problems that a regex linter CANNOT catch. Look specifically for:
- web app missing doGet(e), or doGet not returning HtmlOutput, or missing setXFrameOptionsMode(ALLOWALL)
- a web app whose doGet renders HtmlOutput WITHOUT .addMetaTag('viewport', 'width=device-width, initial-scale=1') — without it the page is zoomed-out and unusable on a phone (most Thai users are mobile) = high
- appsscript.json oauthScopes that DON'T match the services actually used (missing scope = high; over-broad scope = medium — matters for OAuth verification)
- webapp.access that isn't ANYONE_ANONYMOUS for a public no-login web app (plain "ANYONE" still forces a Google sign-in = high for a public tool)
- client↔server calls using fetch() to a URL instead of google.script.run.withSuccessHandler/withFailureHandler
- hardcoded spreadsheet/doc IDs via openById/openByUrl instead of getActiveSpreadsheet/getActiveDocument
- dates formatted with toISOString()/moment/dayjs instead of Utilities.formatDate(date,'Asia/Bangkok',fmt)
- a phone/tel/idcard value written to a Sheet via appendRow([...]) or setValue() when that target column is NOT set to text with setNumberFormat('@') ANYWHERE in the script — the leading 0 is silently dropped (08x → 8x). Trace the appendRow/setValue column order to find the phone field; also flag reading such a column with getValue() instead of getDisplayValue() = high
- user-supplied text written to a Sheet WITHOUT neutralizing a leading = + - @ (formula/CSV injection): such values must be prefixed (e.g. "'" + value) before setValue/appendRow — high when admin views the sheet
- a server entry point (doPost, or a google.script.run target like submitX/save/create) that writes client input to a Sheet WITHOUT validating it server-side (required fields present + basic format, e.g. phone/date) — client-side checks are bypassable, so the server MUST re-validate = high
- missing try/catch on server entry points, or google.script.run without a .withFailureHandler
- concurrent writes to a Sheet without LockService
- container-bound script missing onOpen() menu, or automation implied but no installTriggers() setup function
Only report REAL problems — do not invent issues or nitpick style. If the code is sound, return an empty list.
Each file's content is shown with a "N: " line-number prefix. For every issue include "line": the 1-based
line number (the N) where the problem is — pick the single most relevant line; omit only if truly file-wide.
Reply with ONLY a json object, no prose, no markdown fences (output must be valid json):
{"issues":[{"file":"Code.gs","line":42,"severity":"high|medium|low","problem":"<short>","fix":"<short actionable fix>"}]}`;

function normalizeSeverity(s: unknown): CriticSeverity {
  return s === "high" || s === "low" ? s : "medium";
}

function parseIssues(text: string): CriticIssue[] {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const obj = JSON.parse(match[0]) as { issues?: unknown };
    if (!Array.isArray(obj.issues)) return [];
    return obj.issues
      .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
      .map((i) => {
        const n = Math.trunc(Number(i.line));
        return {
          file: String(i.file ?? "").trim() || "(unknown)",
          line: Number.isFinite(n) && n > 0 ? n : undefined,
          severity: normalizeSeverity(i.severity),
          problem: String(i.problem ?? "").trim(),
          fix: String(i.fix ?? "").trim(),
        };
      })
      .filter((i) => i.problem.length > 0)
      .slice(0, MAX_ISSUES);
  } catch {
    return [];
  }
}

function toResult(issues: CriticIssue[], usage: CriticUsage): CriticResult {
  return { ok: issues.length === 0, issues, ...usage };
}

/** Number every line so the model can cite a 1-based `line` we map to an editor marker. */
function buildReviewPrompt(files: { path: string; content: string }[], project: EgsProject): string {
  const body = files
    .map((f) => {
      const numbered = f.content
        .split("\n")
        .map((ln, i) => `${i + 1}: ${ln}`)
        .join("\n");
      return `=== ${f.path} ===\n${numbered}`;
    })
    .join("\n\n");
  const kind =
    project.kind === "bound"
      ? "container-bound script (bound to a Google Sheet, uses onOpen menu)"
      : "standalone web app (doGet entry point)";
  return `Project kind: ${kind}\n\n${body}`;
}

/** Critic backend: Anthropic (Haiku) — caches the constant rubric (identical on every call). */
async function reviewWithAnthropic(userPrompt: string, model: string): Promise<CriticResult> {
  const client = new Anthropic();
  const msg = await client.messages.create({
    model,
    max_tokens: CRITIC_MAX_TOKENS,
    system: [{ type: "text", text: CRITIC_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return toResult(parseIssues(text), {
    inputTokens: msg.usage?.input_tokens ?? 0,
    outputTokens: msg.usage?.output_tokens ?? 0,
    cacheReadTokens: msg.usage?.cache_read_input_tokens ?? 0,
    cacheCreationTokens: msg.usage?.cache_creation_input_tokens ?? 0,
  });
}

/** Critic backend: DeepSeek (OpenAI wire format via baseURL). Auto-caches the stable system prefix;
 * json_object mode keeps the reply parseable. Non-streaming — it's a short one-shot JSON verdict. */
async function reviewWithDeepSeek(userPrompt: string, model: string): Promise<CriticResult> {
  const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE_URL });
  const res = await client.chat.completions.create({
    model,
    max_tokens: CRITIC_MAX_TOKENS,
    messages: [
      { role: "system", content: CRITIC_SYSTEM },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });
  const text = res.choices[0]?.message?.content ?? "";
  const u = res.usage;
  const cacheHit =
    (u as { prompt_cache_hit_tokens?: number } | undefined)?.prompt_cache_hit_tokens ??
    u?.prompt_tokens_details?.cached_tokens ??
    0;
  return toResult(parseIssues(text), {
    inputTokens: Math.max(0, (u?.prompt_tokens ?? 0) - cacheHit),
    outputTokens: u?.completion_tokens ?? 0,
    cacheReadTokens: cacheHit,
    cacheCreationTokens: 0,
  });
}

export interface CriticInfo {
  provider: CriticProvider;
  model: string;
  /** Is the key for the active critic provider present? (recheck shows "couldn't run" when not.) */
  configured: boolean;
}

/** What the shared critic is currently wired to — for metering + availability checks at call sites. */
export async function getCriticInfo(): Promise<CriticInfo> {
  const { provider, model } = await resolveCritic();
  const configured =
    provider === "claude" ? !!process.env.ANTHROPIC_API_KEY : !!process.env.DEEPSEEK_API_KEY;
  return { provider, model, configured };
}

/**
 * Review every file in a project with the shared rulebook critic (backend chosen in /admin or env).
 * A malformed model reply degrades to ok:true / empty issues (parseIssues never throws); a backend /
 * network error DOES throw — every caller wraps this in try/catch and treats the critic as best-effort
 * (a critic failure must never block the user's result).
 */
export async function reviewProject(project: EgsProject, projectId: string): Promise<CriticResult> {
  const files = await getFiles(projectId);
  if (files.length === 0) return EMPTY;
  const { provider, model } = await resolveCritic();
  const userPrompt = buildReviewPrompt(files, project);
  return provider === "claude"
    ? reviewWithAnthropic(userPrompt, model)
    : reviewWithDeepSeek(userPrompt, model);
}
