// Ces fichiers vivent à une URL stable, contrairement aux bundles qui portent un
// hash. Sans marqueur de version, un appareil ayant déjà l'ancien fichier en
// cache (navigateur ou service worker) continuait de l'afficher après un
// changement. Le suffixe de version force une nouvelle entrée de cache à chaque
// déploiement.
export const LOGO_URL = `${import.meta.env.BASE_URL}logo.png?v=${__APP_VERSION__}`;

/**
 * Photo de fond de la carte Caisse.
 *
 * Pour la changer : remplacer `public/caisse.jpg` et redéployer. Le cadrage
 * privilégie la droite de l'image (cf. object-position), la gauche disparaissant
 * sous le dégradé noir qui porte le texte. Si le fichier est absent, la carte
 * retombe proprement sur un fond uni.
 */
export const CAISSE_IMG = `${import.meta.env.BASE_URL}caisse.jpg?v=${__APP_VERSION__}`;
