/* Oko service worker: opens the app with no network.
 *
 * - App files (/_next/static, icons) are content-hashed: served from the cache first.
 * - Pages: from the network when it answers within a few seconds, else the copy kept from the last visit.
 * - Data (/api) is never cached here: the app keeps its own offline copy and queue (IndexedDB).
 * - The app asks for its main pages to be kept (message "keep") so they open offline even if not visited yet.
 */
const STATIC = "oko-static-v1";
const PAGES = "oko-pages-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll([OFFLINE, "/favicon.svg", "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== STATIC && k !== PAGES).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

const pageKey = (url) => { const u = new URL(url); return u.origin + u.pathname; };

/** Fetch a page, keep it, and keep the app files it needs. */
async function keepPage(url) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  const copy = res.clone();
  const pages = await caches.open(PAGES);
  await pages.put(pageKey(url), copy.clone());
  const html = await copy.text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || [])];
  const stat = await caches.open(STATIC);
  await Promise.all(assets.map(async (a) => { if (!(await stat.match(a))) { try { const r = await fetch(a); if (r.ok) await stat.put(a, r); } catch (_) { /* later */ } } }));
  trim(PAGES, 60); trim(STATIC, 400);
  return res;
}

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)); }

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname === "/backend-health") return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/favicon.svg") {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }

  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        return await Promise.race([keepPage(req.url), timeout(6000)]);
      } catch (_) {
        const pages = await caches.open(PAGES);
        return (await pages.match(pageKey(req.url))) || (await pages.match(OFFLINE)) || Response.error();
      }
    })());
  }
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "keep" && Array.isArray(e.data.urls)) {
    e.waitUntil(Promise.all(e.data.urls.map((u) => keepPage(new URL(u, self.location.origin).href).catch(() => null))));
  }
});
