/**
 * GAS codegen "brain" — ported from KPPromptCreator/lib/gas-codegen.js (CommonJS → ESM/TS).
 *
 * - GAS_RULEBOOK: the static system rulebook (goes in the Anthropic `system` param + cache_control).
 * - buildCodegenSystemPrompt / buildCodegenUserPrompt: split so the rulebook is cached once.
 * - parseCodegenOutput: turns "=== FILENAME.ext ===" blocks into a file map.
 * - validateGasFiles: v1 regex lint gate (errors block, warnings annotate). The full acorn AST
 *   linter (QUALITY-MOAT §3) will live in lib/gas-lint.ts later; this is the cheap first gate.
 */

export interface GasFile {
  name: string;
  content: string;
}

export type ProjectKind = "webapp" | "bound";

export interface LintIssue {
  file: string;
  rule: string;
  message: string;
  severity: "error" | "warning";
}

export interface LintResult {
  errors: LintIssue[];
  warnings: LintIssue[];
}

// ── static rulebook (cache this in the `system` param) ──
export const GAS_RULEBOOK = `You are an expert Google Apps Script (GAS) developer.
Based on the project instruction, generate ALL complete source files for a Google Apps Script project.

## Output Format Rules
- Output ONLY code files, no explanation text before or after
- Each file MUST start with a header line: === FILENAME.ext ===
- Supported extensions: .gs, .html (HTML partials for CSS/JS use .html — GAS convention)
- Include appsscript.json with correct oauthScopes that MATCH the services you actually use
- Every file must be COMPLETE — no placeholders, no "// TODO", no "..."
- Do NOT use import/export, require(), npm packages, fetch(), process.env, setTimeout/setInterval

## Technical Rules
- Use HtmlService.createTemplateFromFile() for includes
- Web app: implement doGet(e) in Code.gs; set .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
- Client↔server: google.script.run.withSuccessHandler().withFailureHandler() (NEVER fetch a server route)
- HTTP requests: UrlFetchApp.fetch() (never fetch/axios)
- ALWAYS SpreadsheetApp.getActiveSpreadsheet() / DocumentApp.getActiveDocument() — NEVER openById/openByUrl with hardcoded IDs
- PropertiesService.getScriptProperties() for config/secrets; LockService for concurrent writes
- Dates: Utilities.formatDate(date, 'Asia/Bangkok', fmt) — NEVER toISOString()/moment/dayjs
- Phone/leading-zero columns in Sheets: setNumberFormat('@') before write + getDisplayValue() on read (Sheets eats the leading 0)
- Filter/transform data server-side before returning; use indexed objects for O(1) lookups (never raw 2D arrays)
- try/catch on both server and client side`;

const BOUND_ADDENDUM = `

## This is a CONTAINER-BOUND script (bound to a Google Sheet)
- Add an onOpen(e) that builds a custom menu with SpreadsheetApp.getUi() (no doGet web app unless asked)
- Use SpreadsheetApp.getActiveSpreadsheet() / getActiveSheet() as the data source
- For time/auth-driven automation, generate an installTriggers() setup function the user runs once`;

export interface CodegenOptions {
  kind?: ProjectKind;
}

/** The system prompt (static rulebook + kind variation) — cache this. */
export function buildCodegenSystemPrompt(options: CodegenOptions = {}): string {
  return options.kind === "bound" ? GAS_RULEBOOK + BOUND_ADDENDUM : GAS_RULEBOOK;
}

/** The per-request user prompt (the actual project intent). */
export function buildCodegenUserPrompt(
  promptContent: string,
  projectName: string,
): string {
  return `## Project: ${projectName}

## Project Instruction:
${promptContent}

Generate all files now. Start each file with === FILENAME.ext ===`;
}

/**
 * Combined prompt (single-shot convenience for the Phase-0 spike / non-cached calls).
 * Prefer the split system+user versions in the cached agent loop.
 */
export function buildCodegenPrompt(
  promptContent: string,
  projectName: string,
  options: CodegenOptions = {},
): string {
  return `${buildCodegenSystemPrompt(options)}\n\n${buildCodegenUserPrompt(promptContent, projectName)}`;
}

/** Parse "=== FILENAME.ext ===" blocks into a file map. */
export function parseCodegenOutput(rawOutput: string): GasFile[] {
  // regex is function-local so its lastIndex never bleeds across calls
  const fileHeaderRe = /^={3,}\s*(.+?)\s*={3,}\s*$/gm;
  const files: GasFile[] = [];
  const matches = [...rawOutput.matchAll(fileHeaderRe)];

  if (matches.length === 0) {
    const trimmed = rawOutput.trim();
    if (trimmed) files.push({ name: "Code.gs", content: trimmed });
    return files;
  }

  for (let i = 0; i < matches.length; i++) {
    const name = matches[i][1].trim();
    const startIdx = (matches[i].index ?? 0) + matches[i][0].length;
    const endIdx =
      i + 1 < matches.length ? matches[i + 1].index ?? rawOutput.length : rawOutput.length;
    const content = rawOutput.substring(startIdx, endIdx).trim();
    if (content) files.push({ name, content });
  }
  return files;
}

const FORBIDDEN: { rule: string; re: RegExp; message: (f: string) => string }[] = [
  { rule: "no-require", re: /\brequire\s*\(/, message: (f) => `${f}: ใช้ require() ไม่ได้ใน GAS` },
  { rule: "no-import", re: /\bimport\s*(?:type\s+)?[\s\S]{0,200}?\bfrom\s+['"]|\bimport\s*\(/, message: (f) => `${f}: ใช้ ES module import ไม่ได้ใน GAS` },
  { rule: "no-export", re: /\bexport\s+(default|function|class|const|let|var)/, message: (f) => `${f}: ใช้ ES module export ไม่ได้ใน GAS` },
  { rule: "no-fetch", re: /\bfetch\s*\(/, message: (f) => `${f}: ใช้ fetch() ไม่ได้ — ใช้ UrlFetchApp.fetch()` },
  { rule: "no-process-env", re: /\bprocess\.env\b/, message: (f) => `${f}: ใช้ process.env ไม่ได้ — ใช้ PropertiesService` },
];

/**
 * v1 regex lint gate. Forbidden runtime patterns = `error` (block + feed back to the model);
 * missing required web-app files = `warning`. Skip web-app-structure checks for bound scripts.
 */
export function validateGasFiles(
  files: GasFile[],
  opts: { isWebApp?: boolean } = { isWebApp: true },
): LintResult {
  const errors: LintIssue[] = [];
  const warnings: LintIssue[] = [];
  const names = files.map((f) => f.name.toLowerCase());

  const hasManifest = names.some((n) => n === "appsscript.json");
  if (!hasManifest) {
    warnings.push({ file: "appsscript.json", rule: "require-manifest", message: "ไม่มี appsscript.json (manifest)", severity: "warning" });
  }
  if (opts.isWebApp !== false) {
    if (!names.some((n) => n === "code.gs")) {
      warnings.push({ file: "Code.gs", rule: "require-code", message: "ไม่มี Code.gs (entry point)", severity: "warning" });
    }
    if (!names.some((n) => n === "index.html")) {
      warnings.push({ file: "Index.html", rule: "require-index", message: "ไม่มี Index.html (หน้าหลัก)", severity: "warning" });
    }
  }

  for (const f of files) {
    if (f.name.toLowerCase().endsWith(".json")) continue; // skip manifest for code patterns
    for (const rule of FORBIDDEN) {
      if (rule.re.test(f.content)) {
        errors.push({ file: f.name, rule: rule.rule, message: rule.message(f.name), severity: "error" });
      }
    }
  }

  return { errors, warnings };
}

/** README with manual + (optional) installer deploy instructions — escape-hatch ZIP fallback. */
export function generateReadme(
  projectName: string,
  files: GasFile[],
  includeInstaller = false,
): string {
  const fileList = files.map((f) => `├── ${f.name}`).join("\n");
  let readme = `# ${projectName}

สร้างโดย easygas — AI builder for Google Apps Script

## ไฟล์ในโปรเจกต์
\`\`\`
${fileList}
\`\`\`

## วิธี Deploy แบบ Manual
1. ไปที่ [script.google.com](https://script.google.com) → "โปรเจกต์ใหม่" → ตั้งชื่อ "${projectName}"
2. คัดลอกไฟล์: Code.gs วางทับ; .gs อื่น ๆ กด + > สคริปต์; .html กด + > HTML; appsscript.json เปิด "แสดงไฟล์ manifest" แล้ววาง
3. ทำให้ใช้งานได้ > การทำให้ใช้งานได้ใหม่ > เว็บแอป (ดำเนินการในฐานะ: ฉัน, เข้าถึง: ทุกคน) > คัดลอก URL
`;
  if (includeInstaller) {
    readme += `
## Deploy อัตโนมัติ
ต้องมี Node.js 18+ — Windows: ดับเบิลคลิก setup.bat ; Mac/Linux: \`chmod +x setup.sh && ./setup.sh\`
`;
  }
  return readme + `\n---\nสร้างโดย easygas\n`;
}
