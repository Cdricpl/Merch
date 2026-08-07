const CACHE = 'ah-merch-v7';
const SCOPE_PATH = new URL(self.registration.scope).pathname;

// Les bundles JS/CSS ont un hash dans leur nom : les servir depuis le cache est
// toujours correct. Ces fichiers-ci gardent au contraire une URL stable d'un
// déploiement à l'autre — en cache-first, on servait éternellement l'ancienne
// version (c'est ce qui figeait le logo après un changement). On les passe donc
// en network-first, avec repli sur le cache hors ligne.
const UNVERSIONED = /\/(logo\.png|icon-[^/]*\.png|icon\.svg|manifest\.webmanifest)$/;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  // Network-first for HTML (so a deploy applies immediately) and for the
  // unversioned assets above (so a new logo/icon actually shows up).
  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  if (isHTML || UNVERSIONED.test(url.pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() =>
          caches.open(CACHE).then((c) => c.match(e.request).then((r) => r || Response.error()))
        )
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(e.request).then((cached) => {
        const network = fetch(e.request).then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    )
  );
});
