// Service worker for the installable app shell.
//
// Strategy: network first, cache as a fallback. The club's content changes
// often (bookings, rosters, news), so we always try the network and only
// fall back to the last copy we saw when the phone is offline or has no
// signal. Live data (/api, /.netlify/functions) is never cached.
//
// Bump CACHE_NAME whenever this file's caching rules change.
const CACHE_NAME = "guh-shell-v1";
const SHELL_URL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

function isLiveData(url) {
  return url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/.netlify/");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isLiveData(url)) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only keep good, same-origin responses as the offline copy.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline page navigation with nothing cached for this exact URL:
          // the app is a hash router, so the shell can render any route.
          if (request.mode === "navigate") {
            return caches.match(SHELL_URL);
          }
          return Response.error();
        })
      )
  );
});
