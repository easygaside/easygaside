/**
 * Gate 2 (run-and-repair) — Channel 1: server-side HTTP probe of a deployed GAS web app's /exec URL.
 * The real deploy publishes /exec as ANYONE_ANONYMOUS + executeAs USER_DEPLOYING (lib/deploy.ts), so
 * our server CAN fetch it (unlike /dev, which needs the owner's browser session). We classify the
 * response: a GAS runtime failure renders an HTML error page (often HTTP 200), so we match content
 * signatures rather than trusting the status code. Heuristic by design — it answers "did it blow up
 * when actually run?", which the static lint + rulebook critic structurally cannot.
 */

// Shared with the rulebook self-diagnostics rule (gas-codegen): doGet returns the raw error as
// "EGS_ERROR: <stack>" when this param is present, so the probe gets the exact message + line.
const DIAG_PARAM = "__egsdiag";
const DIAG_TOKEN = "egsverify";
const SELF_REPORT = /EGS_ERROR:\s*([\s\S]{0,600})/;

// Strong signatures that mean a GAS-level failure (avoid generic "error" to limit false positives).
const FAIL_SIGNATURES: { re: RegExp; label: string }[] = [
  { re: /Script function not found:?\s*\w*/i, label: "หาฟังก์ชันเริ่มต้นไม่เจอ (เช่น doGet)" },
  { re: /(TypeError|ReferenceError|SyntaxError|RangeError):[^<\n]{0,200}/i, label: "" },
  { re: /Exception:[^<\n]{0,200}/i, label: "" },
  { re: /We['’]re sorry, a server error occurred[^<\n]{0,160}/i, label: "เกิดข้อผิดพลาดฝั่งสคริปต์" },
];

// NOT a code bug → don't try to repair; the owner just needs to authorize/publish the app once.
const NEEDS_AUTH = /Authorization is required to perform that action/i;
const LOGIN_WALL = /accounts\.google\.com\/(v3\/signin|ServiceLogin|signin)|Sign in[^<]{0,20}Google/i;

function stripToSnippet(html: string, match: string): string {
  // pull a window around the match, strip tags + collapse whitespace, cap length
  const idx = html.indexOf(match);
  const slice = idx >= 0 ? html.slice(idx, idx + 240) : match;
  return slice
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

export interface ProbeResult {
  ok: boolean;
  error?: string; // human-readable error when ok=false
  /** true = the owner just needs to authorize/publish the app once — NOT a code bug, don't repair. */
  authRequired?: boolean;
}

/** Fetch the live /exec and decide pass/fail. Never throws — network issues return ok:false. */
export async function probeExec(execUrl: string): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    // ask the app to self-report its error (rulebook self-diagnostics) → exact message + line
    const url = execUrl + (execUrl.includes("?") ? "&" : "?") + `${DIAG_PARAM}=${DIAG_TOKEN}`;
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal });
    const finalUrl = res.url || execUrl;
    const text = await res.text();

    // needs-auth cases first — these are NOT code bugs (don't repair, ask the owner to authorize)
    if (NEEDS_AUTH.test(text))
      return { ok: false, authRequired: true, error: "แอปยังไม่ได้รับอนุญาตให้รัน — เจ้าของต้องเปิดแล้วกด Allow ครั้งแรก" };
    if (LOGIN_WALL.test(finalUrl) || LOGIN_WALL.test(text))
      return { ok: false, authRequired: true, error: "แอปยังเปิดให้รันสาธารณะไม่ได้ (อาจยังไม่ได้ deploy / สิทธิ์เข้าถึงไม่ใช่ ANYONE_ANONYMOUS)" };

    // self-reported error from doGet's catch (the precise one) wins
    const sr = text.match(SELF_REPORT);
    if (sr) return { ok: false, error: sr[1].replace(/\s+/g, " ").trim().slice(0, 400) };

    if (res.status >= 500) return { ok: false, error: `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status} ตอนเปิดแอป` };
    for (const { re, label } of FAIL_SIGNATURES) {
      const m = text.match(re);
      if (m) {
        const detail = stripToSnippet(text, m[0]);
        return { ok: false, error: label ? `${label}${detail && detail !== m[0] ? ` — ${detail}` : ""}` : detail || m[0] };
      }
    }
    // Looks like the app rendered without a GAS-level error.
    return { ok: true };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "เปิดแอปไม่ตอบใน 12 วินาที (อาจค้าง/ช้า)" : "เปิดแอปไม่ได้ (เชื่อมต่อล้มเหลว)" };
  } finally {
    clearTimeout(timer);
  }
}
