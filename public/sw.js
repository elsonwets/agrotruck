// AgroTrucks — service worker (hors ligne).
// - Installation : les écrans clés de la langue de l'utilisateur et leurs fichiers sont mis en cache.
// - Pages : réseau d'abord, dernière version en cache sinon (même URL sans paramètres), puis la page « hors ligne ».
// - Fichiers statiques (/assets, polices, logos) : cache d'abord.
// Les données passent par Convex (WebSocket) : elles sont gardées par l'application elle-même (localStorage).
const CACHE = "agrotrucks-v1";
const LANG = new URL(self.location.href).searchParams.get("lang") || "pt";
const KEY_PAGES = ["", "/offline", "/producer", "/producer/new", "/transporter", "/transporter/missions", "/transporter/trucks", "/profile", "/login"]
  .map((path) => `/${LANG}${path}`);
const STATIC = ["/manifest.webmanifest", "/brand/agrotruck-icon-192.png", "/brand/agrotruck-mark-transparent.webp", "/fonts/poppins-400.woff2", "/fonts/poppins-600.woff2"];

async function cachePage(cache, path) {
  const response = await fetch(path, { cache: "reload", credentials: "same-origin" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put(path, response);
  const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
  await Promise.all(assets.map((asset) => cache.add(asset).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then(async (cache) => {
    await cache.addAll(STATIC).catch(() => undefined);
    for (const path of KEY_PAGES) await cachePage(cache, path).catch(() => undefined);
  }));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok && /^\/(fr|en|pt)(\/|$)/.test(url.pathname)) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
      }
      return response;
    }).catch(async () => {
      const lang = (url.pathname.match(/^\/(fr|en|pt)/) || [])[1] || LANG;
      return (await caches.match(url.pathname)) || (await caches.match(`/${lang}/offline`)) || (await caches.match(`/${LANG}/offline`)) || Response.error();
    }));
    return;
  }

  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/fonts/") || url.pathname.startsWith("/brand/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then((cache) => cache.put(request, copy)); }
      return response;
    })));
  }
});
