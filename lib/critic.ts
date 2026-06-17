import Anthropic from "@anthropic-ai/sdk";
import { getFiles } from "@/lib/files";
import type { EgsProject } from "@/types/db";

/**
 * Gate 1 — rulebook critic (QUALITY-MOAT §2): a single cheap LLM-as-judge pass that catches
 * semantic best-practice violations the regex lint (gate 0, lib/gas-codegen.validateGasFiles)
 * structurally cannot. It is a pre-filter, NOT a "does it run" verdict — that is gate 2
 * (dynamic run-and-repair, deferred). The agent loop runs ONE bounded auto-repair from its output.
 */

// The critic is an LLM-as-judge pre-filter against a very prescriptive rubric — Haiku handles it
// well at a fraction of Sonnet's cost. It runs on EVERY provider arm (the shared Claude yardstick),
// so this one swap lowers cost for the chatgpt/deepseek/gemini arms too, not just Claude. If critic
// recall ever drops noticeably, bump back to claude-sonnet-4-6.
const MODEL_CRITIC = "claude-haiku-4-5-20251001";
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
}

const CRITIC_SYSTEM = `You are a senior Google Apps Script (GAS) reviewer. Review the project files for
correctness / best-practice problems that a regex linter CANNOT catch. Look specifically for:
- web app missing doGet(e), or doGet not returning HtmlOutput, or missing setXFrameOptionsMode(ALLOWALL)
- appsscript.json oauthScopes that DON'T match the services actually used (missing scope = high; over-broad scope = medium — matters for OAuth verification)
- client↔server calls using fetch() to a URL instead of google.script.run.withSuccessHandler/withFailureHandler
- hardcoded spreadsheet/doc IDs via openById/openByUrl instead of getActiveSpreadsheet/getActiveDocument
- dates formatted with toISOString()/moment/dayjs instead of Utilities.formatDate(date,'Asia/Bangkok',fmt)
- leading-zero columns (phone/tel/idcard) written without setNumberFormat('@') or read without getDisplayValue()
- missing try/catch on server entry points, or google.script.run without a .withFailureHandler
- concurrent writes to a Sheet without LockService
- container-bound script missing onOpen() menu, or automation implied but no installTriggers() setup function
Only report REAL problems — do not invent issues or nitpick style. If the code is sound, return an empty list.
Each file's content is shown with a "N: " line-number prefix. For every issue include "line": the 1-based
line number (the N) where the problem is — pick the single most relevant line; omit only if truly file-wide.
Reply with ONLY a JSON object, no prose, no markdown fences:
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

/**
 * Review every file in a project. Non-throwing on a malformed model reply (returns ok:true,
 * empty issues) so the critic can never block a user's result — the caller treats it as best-effort.
 */
export async function reviewProject(
  client: Anthropic,
  project: EgsProject,
  projectId: string,
): Promise<CriticResult> {
  const files = await getFiles(projectId);
  if (files.length === 0) return { ok: true, issues: [], inputTokens: 0, outputTokens: 0 };

  // number every line so the model can cite a 1-based `line` we map to an editor marker
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

  const msg = await client.messages.create({
    model: MODEL_CRITIC,
    max_tokens: CRITIC_MAX_TOKENS,
    // cache the constant rubric (it's identical on every review call)
    system: [{ type: "text", text: CRITIC_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `Project kind: ${kind}\n\n${body}` }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const issues = parseIssues(text);
  return {
    ok: issues.length === 0,
    issues,
    inputTokens: msg.usage?.input_tokens ?? 0,
    outputTokens: msg.usage?.output_tokens ?? 0,
  };
}
