const CACHE_NAME = "jarvis-cache-v44";
const FILES = ["./", "./index.html", "./styles.css", "./app.js?v=jarvis-44", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first: refresh installed clients online and keep a reliable cache fallback.
  const networkResponse = fetch(event.request);
  const cacheUpdate = networkResponse.then(response => {
    if (!response.ok) return;
    return caches.open(CACHE_NAME).then(cache =>
      cache.put(event.request, response.clone())
    );
  }).catch(() => {});
  event.waitUntil(cacheUpdate);
  event.respondWith(
    networkResponse.catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
