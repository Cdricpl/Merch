import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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
export const db = getFirestore(app);
