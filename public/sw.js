// What the shop can still do with no signal.
//
// Deliberately small, because a service worker on a shop is a way to serve
// yesterday's prices. The rule here: never cache a page. Pages are prices,
// stock and someone's own account, and a stale one is worse than no page at
// all. What is cached is the stuff that cannot go stale — Next's
// content-hashed bundles, the logo, the category photographs — and one
// offline page to land on when the network is gone.
const VERSION = "sl-1";
const ASSETS = `assets-${VERSION}`;
const SHELL = `shell-${VERSION}`;
const OFFLINE_URL = "/offline";

// Anything that is about one person, their money, or the admin desk stays off
// this worker entirely, in both directions.
const NEVER = [/^\/api\//, /^\/admin/, /^\/checkout/, /^\/cart/, /^\/account/, /^\/payments?\//];

const IMMUTABLE = [/^\/_next\/static\//, /^\/icon-/, /^\/apple-touch-icon\.png$/, /^\/logo\./];
const PICTURES = [/^\/(brand|categories|concerns|promotions|mascot)\//];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((re) => re.test(url.pathname))) return;

  // A page is always fetched fresh. Offline, it is the offline page rather
  // than a cached one that might be quoting a price that has since changed.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const immutable = IMMUTABLE.some((re) => re.test(url.pathname));
  const picture = PICTURES.some((re) => re.test(url.pathname));
  if (!immutable && !picture) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request).then((response) => {
        // Only a good answer is worth keeping; a 404 cached is a 404 forever.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(ASSETS).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
