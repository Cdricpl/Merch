// Le logo vit à une URL stable (`logo.png`), contrairement aux bundles qui
// portent un hash. Sans marqueur de version, un appareil ayant déjà l'ancien
// fichier en cache (navigateur ou service worker) continuait de l'afficher après
// un changement de logo. Le suffixe de version force une nouvelle entrée de
// cache à chaque déploiement.
export const LOGO_URL = `${import.meta.env.BASE_URL}logo.png?v=${__APP_VERSION__}`;
