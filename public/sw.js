const CACHE = 'ah-merch-v33';
const SCOPE_PATH = new URL(self.registration.scope).pathname;

// Les bundles JS/CSS ont un hash dans leur nom : les servir depuis le cache est
// toujours correct. Ces fichiers-ci gardent au contraire une URL stable d'un
// déploiement à l'autre — en cache-first, on servait éternellement l'ancienne
// version (c'est ce qui figeait le logo après un changement). On les passe donc
// en network-first, avec repli sur le cache hors ligne.
const UNVERSIONED = /\/(logo\.png|icon-[^/]*\.png|manifest\.webmanifest)$/;

// La liste des fichiers préchargés est écrite ici à l'installation, pour que
// `activate` puisse vérifier que le nouveau cache sait démarrer l'app seul.
const MANIFEST = SCOPE_PATH + '__precache__';

/**
 * Précharge la coquille de l'app.
 *
 * Les bundles portent un hash : leurs URL ne sont connues qu'en lisant l'index.
 * On le télécharge donc, on en extrait les scripts et les styles, et on met le
 * tout en cache. Sans ça, le nouveau cache est VIDE au moment où l'ancien est
 * supprimé — et un réveil sans réseau ne trouve plus rien pour afficher l'app.
 */
async function precache(cache) {
  const res = await fetch(SCOPE_PATH, { cache: 'reload' });
  if (!res.ok) throw new Error('index indisponible');

  const html = await res.clone().text();
  await cache.put(SCOPE_PATH, res);

  const base = self.location.origin + SCOPE_PATH;
  const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)]
    .map((m) => new URL(m[1], base).href)
    .filter((u) => u.startsWith(self.location.origin));

  await Promise.all(urls.map((u) => cache.add(u)));
  await cache.put(MANIFEST, new Response(JSON.stringify(urls)));
}

/** Le cache peut-il démarrer l'app à lui seul, réseau coupé ? */
async function canBoot(cache) {
  const manifest = await cache.match(MANIFEST);
  if (!manifest || !(await cache.match(SCOPE_PATH))) return false;
  try {
    const urls = await manifest.json();
    for (const u of urls) if (!(await cache.match(u))) return false;
    return true;
  } catch {
    return false;
  }
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    try {
      await precache(await caches.open(CACHE));
    } catch {
      // Réseau absent ou instable pendant l'installation : on n'a rien pu
      // précharger. `activate` le verra et laissera l'ancienne version en
      // place plutôt que de tout casser.
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const ready = await canBoot(cache);

    // Ne JAMAIS jeter l'ancien cache tant que le nouveau ne sait pas démarrer
    // l'app tout seul. Un téléphone qui sort de veille n'a pas encore son
    // réseau : supprimer l'ancienne version à cet instant laissait l'écran
    // vide, sans rien pour le reconstruire.
    if (ready) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    }
    await self.clients.claim();

    // Même prudence pour le rechargement forcé : inutile de recharger une page
    // qu'on ne saurait pas resservir. La mise à jour se fera au prochain
    // passage, quand le réseau sera revenu.
    if (!ready) return;

    // Rechargement forcé des fenêtres ouvertes. C'est le service worker qui
    // pilote, et non la page : un appareil resté sur une ancienne version n'a
    // pas le code qui saurait se recharger tout seul.
    //
    // Les ventes en attente d'envoi survivent : Firestore les conserve dans
    // IndexedDB (cf. firebase.ts) et les rejoue après le rechargement.
    const windows = await self.clients.matchAll({ type: 'window' });
    for (const c of windows) {
      if (typeof c.navigate === 'function') {
        try { await c.navigate(c.url); } catch { /* onglet non contrôlé */ }
      }
    }
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE_PATH)) return;

  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  // Réseau d'abord pour le HTML (un déploiement s'applique tout de suite) et
  // pour les fichiers à URL stable (un nouveau logo doit apparaître).
  if (isHTML || UNVERSIONED.test(url.pathname)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
        return res;
      } catch {
        // On cherche dans TOUS les caches, pas seulement le courant : au
        // réveil, le réseau met un instant à revenir, et c'est parfois la
        // génération précédente qui sauve l'affichage.
        return (await caches.match(e.request))
          || (isHTML ? await caches.match(SCOPE_PATH) : null)
          || Response.error();
      }
    })());
    return;
  }

  // Cache d'abord pour les bundles hachés : leur contenu ne change jamais.
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(CACHE)).put(e.request, res.clone());
      return res;
    } catch {
      // Renvoyer une erreur explicite plutôt qu'un `undefined`, qui faisait
      // échouer la requête d'une façon impossible à diagnostiquer.
      return Response.error();
    }
  })());
});
