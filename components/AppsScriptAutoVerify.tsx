"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Silent, automatic readiness check for connected-but-unverified accounts. On mount it fires one
 * real Apps Script write (/api/gas/verify) in the background: success flips apps_script_ready and
 * we refresh into the "ready" state; failure (e.g. Apps Script API toggle still off) is ignored and
 * the server-rendered enable walkthrough stays. Renders nothing — runs once per mount.
 */
export function AppsScriptAutoVerify() {
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    fetch("/api/gas/verify", { method: "POST" })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (!cancelled && d?.ok) router.refresh();
      })
      .catch(() => {
        /* toggle off / transient — leave the enable walkthrough in place */
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
