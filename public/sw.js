// AgroTrucks — service worker (hors ligne).
// - Coquille : les écrans clés et leurs fichiers sont mis en cache à l'installation.
// - Pages : réseau d'abord, cache si hors ligne (la même page sert pour tous les ?id=).
// - Données (missions, session, profil) : réseau d'abord, dernière réponse connue si hors ligne ; la page est
//   prévenue (message "offline-data") pour afficher « Hors ligne — données du … ». Vidé à la déconnexion.
const SHELL_CACHE = "agrotruck-shell-v2";
const DATA_CACHE = "agrotruck-data-v1";
const STATIC_ASSETS = [
  "/offline",
  "/brand/agrotruck-icon-192.png",
  "/brand/agrotruck-icon-512.png",
  "/brand/agrotruck-icon-maskable-512.png",
  "/brand/agrotruck-mark.png",
];
const APP_PAGES = [
  "/", "/login", "/profil",
  "/producteur", "/producteur/demande", "/producteur/demande/nouvelle",
  "/partner", "/partner/mission",
];
const CACHED_DATA = [/^\/\.netlify\/functions\/orders/, /^\/\.netlify\/functions\/auth\?action=(session|profile)$/, /^\/\.netlify\/functions\/trucks\?mine=1$/];

// Met en cache une page et les fichiers /_next/static qu'elle référence.
async function cachePage(cache, path) {
  const response = await fetch(path, { cache: "reload" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(path, response);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? [])];
  await Promise.all(assets.map((asset) => cache.add(asset).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then(async (cache) => {
    await cache.addAll(STATIC_ASSETS);
    await Promise.all(APP_PAGES.map((path) => cachePage(cache, path).catch(() => undefined)));
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (CACHED_DATA.some((pattern) => pattern.test(url.pathname + url.search))) {
    event.respondWith(networkFirstData(request, event.clientId));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () =>
      (await caches.match(request, { ignoreSearch: true })) ?? (await caches.match(url.pathname)) ?? caches.match("/offline")));
    return;
  }

  if (url.pathname.startsWith("/brand/") || url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/fonts/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)); }
      return response;
    })));
  }
});

async function networkFirstData(request, clientId) {
  const client = clientId ? await self.clients.get(clientId) : null;
  try {
    const response = await fetch(request);
    client?.postMessage({ type: "online-data" }); // le réseau répond de nouveau
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set("x-agrotruck-cached-at", new Date().toISOString());
      const copy = new Response(await response.clone().blob(), { status: response.status, headers });
      const cache = await caches.open(DATA_CACHE);
      await cache.put(request, copy);
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: DATA_CACHE });
    client?.postMessage({ type: "offline-data", cachedAt: cached?.headers.get("x-agrotruck-cached-at") ?? null });
    return cached ?? new Response(JSON.stringify({ error: "Hors ligne" }), { status: 503, headers: { "content-type": "application/json" } });
  }
}
