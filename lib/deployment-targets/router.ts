import type { TargetId } from "@/types/db";

/**
 * Capability router (BUILDPLAN §J.3) — a PURE function (no model calls) that maps the project's
 * capability needs to a target. Any modern-web signal routes to the web target; otherwise GAS.
 * Today the web target is not built, so `notImplemented` is surfaced honestly instead of silently
 * deploying GAS code to the wrong runtime.
 */

export interface CapabilityNeeds {
  liveCamera?: boolean;
  realtime?: boolean;
  npmPackages?: boolean;
  customDomain?: boolean;
  publicSeo?: boolean;
  stillPhoto?: boolean;
  workspaceData?: boolean;
}

export interface RouteDecision {
  target: TargetId;
  reasons: string[];
  /** true when the chosen target is documented but NOT implemented yet (web target). */
  notImplemented: boolean;
}

const WEB_SIGNALS: { key: keyof CapabilityNeeds; reason: string }[] = [
  { key: "liveCamera", reason: "ต้องใช้กล้องสด — GAS บล็อก getUserMedia" },
  { key: "realtime", reason: "ต้องการ realtime/อัปเดตสด" },
  { key: "npmPackages", reason: "ต้องใช้ npm package" },
  { key: "customDomain", reason: "ต้องการโดเมนของตัวเอง" },
  { key: "publicSeo", reason: "ต้องการหน้า public ทำ SEO" },
];

export function routeTarget(needs: CapabilityNeeds = {}): RouteDecision {
  const reasons = WEB_SIGNALS.filter((s) => needs[s.key]).map((s) => s.reason);
  if (reasons.length > 0) {
    return { target: "web-supabase", reasons, notImplemented: true };
  }
  return {
    target: "gas",
    reasons: ["ใช้ข้อมูล Workspace + โฮสต์ฟรี ไม่มีสัญญาณเว็บ → GAS"],
    notImplemented: false,
  };
}
