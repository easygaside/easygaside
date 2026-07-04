/**
 * EasyGAS service worker — hand-rolled (no next-pwa).
 * Precache the offline shell, network-first for navigations, and handle
 * Web Push + notification clicks. Served with no-cache (see next.config.ts)
 * so a deploy always ships the fresh worker.
 */
const CACHE = "easygas-v1";
const PRECACHE = ["/offline.html", "/icon/android-icon-192x192.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) =>
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())),
);

self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;
  // Network-first for page navigations with an offline fallback. Everything else
  // (API, SSE, assets) goes straight to the network untouched.
  if (req.mode === "navigate") {
    e.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          return (await (await caches.open(CACHE)).match("/offline.html")) || Response.error();
        }
      })(),
    );
  }
});

self.addEventListener("push", (e) => {
  let d = { title: "EasyGAS", body: "", url: "/projects", tag: undefined, urgent: false };
  try {
    if (e.data) d = { ...d, ...e.data.json() };
  } catch {
    if (e.data) d.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: "/icon/android-icon-192x192.png",
      badge: "/icon/android-icon-96x96.png",
      lang: "th",
      data: { url: d.url || "/projects" },
      tag: d.tag || undefined, // same tag → collapse (e.g. one bubble per chat thread)
      renotify: !!d.tag,
      requireInteraction: !!d.urgent,
      vibrate: d.urgent ? [200, 100, 200, 100, 200] : undefined,
    }),
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "/projects";
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          try {
            await c.navigate(target);
          } catch {}
          return c.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});
