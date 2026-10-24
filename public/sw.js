// The cache name is bumped whenever the caching rules change. The old caches
// are deleted on activation, so a rule change also purges anything the
// previous rules wrote.
const CACHE = "playground-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request("/", { cache: "reload" })))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The API is same-origin, so its responses look like any other same-origin
  // GET to this worker. They are the clinic's data - children, notes,
  // assignments - and they belong to the signed-in session, not to the
  // device. Caching them would hand the next person who opens the app on a
  // shared device everything the last person was allowed to see, without
  // even a network request. The API is therefore never cached and never
  // served from the cache.
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;

  // HTML and other navigations must be network-first. Serving a cached shell
  // here is how a deploy leaves visitors on old asset hashes for hours.
  if (request.mode === "navigate") {
    // A navigation with a query string is an invitation or a password reset.
    // Its URL carries a one-time token, so it is never written to the cache
    // and never answered from one.
    const hasQuery = url.search !== "";
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!hasQuery) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match(self.registration.scope)),
        ),
    );
    return;
  }

  // Hashed build assets are immutable, so serve them from cache first and only
  // hit the network on a miss.
  const isHashedAsset = /\/assets\/.+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|svg|jpe?g|webp)$/.test(
    url.pathname,
  );

  if (isHashedAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200 && response.type === "basic") {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Everything left is a static file. Only same-origin, non-redirected,
  // successful responses are stored, and a query string keeps it out of the
  // cache for the same reason as above.
  if (url.search !== "") return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
