"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (/sw.js) once on mount, and — when the user
 * already granted notification permission — re-syncs the existing push
 * subscription to the server so the endpoint↔user link stays fresh across
 * logins/devices. Renders nothing; mounted globally in app/layout.tsx.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (cancelled) return;
        // Best-effort push re-sync (endpoint may rotate; server upserts on endpoint).
        if ("pushManager" in reg && Notification.permission === "granted") {
          const sub = await reg.pushManager.getSubscription();
          if (sub && !cancelled) {
            fetch("/api/push/subscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(sub.toJSON()),
            }).catch(() => {});
          }
        }
      } catch {
        // SW registration failure is non-fatal (e.g. private mode) — app works without it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
