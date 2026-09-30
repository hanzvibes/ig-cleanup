const CACHE_PREFIX = "ig-cleanup-";
const CACHE_NAME = "ig-cleanup-v0.10.1";
const CORE_ASSETS = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const staleKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME);

    await Promise.all(staleKeys.map((key) => caches.delete(key)));
    await self.clients.claim();

    if (staleKeys.length > 0) {
      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.all(clients.map((client) => client.navigate(client.url)));
    }
  })());
});

const networkFirst = async (request, fallbackKey) => {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put(fallbackKey ?? request, copy));
    }
    return response;
  } catch {
    return (await caches.match(fallbackKey ?? request)) || Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
    return;
  }

  event.respondWith(networkFirst(request));
});
