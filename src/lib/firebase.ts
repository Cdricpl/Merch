import { initializeApp } from "firebase/app";
import {
  disableNetwork,
  enableNetwork,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

// Config injected at build-time via VITE_FIREBASE_CONFIG (JSON string).
// Set this as a GitHub Actions secret. See README-FIREBASE.md for the setup.
const raw = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;

function fatal(msg: string): never {
  const div = document.createElement("div");
  div.style.cssText =
    "position:fixed;inset:0;background:#1a0a0a;color:#fff;padding:20px;font:14px/1.4 system-ui;z-index:99999;overflow:auto;";
  div.innerHTML =
    "<h1 style='color:#e33'>Configuration Firebase manquante</h1>" +
    `<p>${msg}</p>` +
    "<p>Ajoute le secret <code>VITE_FIREBASE_CONFIG</code> dans GitHub Actions (Settings → Secrets → Actions).</p>" +
    "<p>Contenu attendu : le bloc <code>firebaseConfig</code> du dashboard Firebase, en JSON sur une ligne.</p>";
  document.body.appendChild(div);
  throw new Error(msg);
}

if (!raw) fatal("VITE_FIREBASE_CONFIG non défini dans le build.");

let config: Record<string, string>;
try {
  config = JSON.parse(raw);
} catch (e) {
  fatal(`VITE_FIREBASE_CONFIG n'est pas du JSON valide : ${(e as Error).message}`);
}

const required = ["apiKey", "authDomain", "projectId", "appId"] as const;
const missing = required.filter((k) => !config[k]);
if (missing.length > 0) {
  fatal(`Champs manquants dans VITE_FIREBASE_CONFIG : ${missing.join(", ")}`);
}

const app = initializeApp(config);

// Persistance IndexedDB : les ventes saisies sans réseau (sous-sol de salle,
// 4G saturée) restent en file d'attente et partent toutes seules au retour de
// la connexion, même si l'app a été fermée entre-temps. Sans ça, le cache n'est
// qu'en mémoire et un rechargement perdait les écritures en attente.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Navigateur sans IndexedDB (mode privé sur certains Safari) : on retombe
    // sur le cache mémoire, l'app reste pleinement utilisable en ligne.
    return getFirestore(app);
  }
})();

/**
 * Force le SDK à jeter sa connexion et à en rouvrir une.
 *
 * Quand le téléphone met l'app en veille, le flux temps réel de Firestore meurt
 * sans que le SDK ne s'en aperçoive : au réveil, il croit être connecté et
 * n'envoie plus rien. Se réabonner ne suffit pas — les écoutes partagent le même
 * flux mort. Ce cycle-là le reconstruit vraiment.
 *
 * Les écritures en attente ne sont pas perdues : elles restent dans IndexedDB et
 * repartent dès que le réseau est réactivé.
 */
export async function kickConnection(): Promise<void> {
  try {
    await disableNetwork(db);
    await enableNetwork(db);
  } catch {
    /* bascule déjà en cours, ou SDK en cours d'arrêt */
  }
}
