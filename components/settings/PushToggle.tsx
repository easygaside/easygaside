"use client";

import { useCallback, useEffect, useState } from "react";
import { BellAlertIcon, BellSlashIcon } from "@heroicons/react/24/outline";

/**
 * Web Push opt-in toggle (settings page). Talks to /api/push/subscribe; the
 * VAPID public key is baked in at build time via NEXT_PUBLIC_VAPID_PUBLIC_KEY.
 */

type PushState = "loading" | "unsupported" | "denied" | "on" | "off";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function PushToggle() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    (async () => {
      if (
        !vapidKey ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("off");
      }
    })();
  }, [vapidKey]);

  const enable = useCallback(async () => {
    if (!vapidKey || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("subscribe api failed");
      setState("on");
    } catch (e) {
      console.error("[push] enable failed:", e);
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [vapidKey, busy]);

  const disable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      console.error("[push] disable failed:", e);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  if (state === "loading") return null;

  if (state === "unsupported")
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
        เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือนแบบ push — บน iPhone/iPad ต้องกด &quot;เพิ่มลงหน้าจอโฮม&quot;
        (Add to Home Screen) ก่อน แล้วเปิดจากไอคอนแอป
      </p>
    );

  if (state === "denied")
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
        การแจ้งเตือนถูกปิดไว้ในเบราว์เซอร์ — เปิดใหม่ได้ที่การตั้งค่าเว็บไซต์ (ไอคอน 🔒 ข้าง URL) แล้วรีเฟรชหน้า
      </p>
    );

  const on = state === "on";
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700/60 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        {on ? (
          <BellAlertIcon className="h-5 w-5 text-emerald-500" />
        ) : (
          <BellSlashIcon className="h-5 w-5 text-slate-400" />
        )}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            แจ้งเตือนแบบ push
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {on ? "เปิดอยู่ — เด้งเตือนแม้ปิดหน้าเว็บ (แชทตอบกลับ / แพ็กเกจอนุมัติ)" : "ปิดอยู่"}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={on ? disable : enable}
        disabled={busy}
        aria-pressed={on}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
        } ${busy ? "opacity-60" : ""}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
