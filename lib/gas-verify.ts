/**
 * Gate 2 (run-and-repair) — Channel 1: server-side HTTP probe of a deployed GAS web app's /exec URL.
 * The real deploy publishes /exec as ANYONE_ANONYMOUS + executeAs USER_DEPLOYING (lib/deploy.ts), so
 * our server CAN fetch it (unlike /dev, which needs the owner's browser session). We classify the
 * response: a GAS runtime failure renders an HTML error page (often HTTP 200), so we match content
 * signatures rather than trusting the status code. Heuristic by design — it answers "did it blow up
 * when actually run?", which the static lint + rulebook critic structurally cannot.
 */

// Strong signatures that mean a GAS-level failure (avoid generic "error" to limit false positives).
const FAIL_SIGNATURES: { re: RegExp; label: string }[] = [
  { re: /Script function not found:?\s*\w*/i, label: "หาฟังก์ชันเริ่มต้นไม่เจอ (เช่น doGet)" },
  { re: /(TypeError|ReferenceError|SyntaxError|RangeError):[^<\n]{0,200}/i, label: "" },
  { re: /Exception:[^<\n]{0,200}/i, label: "" },
  { re: /We['’]re sorry, a server error occurred[^<\n]{0,160}/i, label: "เกิดข้อผิดพลาดฝั่งสคริปต์" },
  { re: /Authorization is required to perform that action[^<\n]{0,120}/i, label: "ต้องอนุญาตสิทธิ์ก่อน (เปิดสคริปต์แล้วกด Allow)" },
];

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
  error?: string; // human-readable Thai-ish error when ok=false
}

/** Fetch the live /exec and decide pass/fail. Never throws — network issues return ok:false. */
export async function probeExec(execUrl: string): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(execUrl, { redirect: "follow", signal: ctrl.signal });
    const finalUrl = res.url || execUrl;
    const text = await res.text();

    if (LOGIN_WALL.test(finalUrl) || LOGIN_WALL.test(text)) {
      return { ok: false, error: "แอปเรียกให้ล็อกอินก่อนเปิด — ตั้งสิทธิ์เข้าถึงยังไม่เป็นสาธารณะ (ANYONE_ANONYMOUS)" };
    }
    if (res.status >= 500) {
      return { ok: false, error: `เซิร์ฟเวอร์ตอบกลับ HTTP ${res.status} ตอนเปิดแอป` };
    }
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
