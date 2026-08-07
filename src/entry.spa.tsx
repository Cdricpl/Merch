import "./styles.css";
import ReactDOM from "react-dom/client";
import App from "./App";
// Doit être importé avant le rendu : capture `beforeinstallprompt`, qui est
// souvent émis avant que React ne soit monté.
import "./lib/pwaInstall";

// Global error surface for debugging on mobile (no devtools available)
function showError(label: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}\n${err.stack ?? ""}` : String(err);
  let box = document.getElementById("app-error");
  if (!box) {
    box = document.createElement("div");
    box.id = "app-error";
    box.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#b00020;color:#fff;padding:12px;font:12px/1.4 system-ui;white-space:pre-wrap;max-height:50vh;overflow:auto;";
    document.body.appendChild(box);
  }
  box.textContent = (box.textContent ? box.textContent + "\n\n" : "") + `[${label}] ${msg}`;
}
window.addEventListener("error", (e) => showError("error", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => showError("promise", e.reason));

// Service worker + mise à jour automatique.
if ("serviceWorker" in navigator) {
  // Au tout premier enregistrement il n'y a pas encore de contrôleur : le
  // changement qui suit n'est pas une mise à jour, il ne faut pas recharger.
  const hadController = navigator.serviceWorker.controller !== null;
  let reloading = false;

  // Repli pour les navigateurs sans WindowClient.navigate() (Safari/iOS) :
  // là-bas, c'est la page qui doit se recharger quand un nouveau service
  // worker prend la main. Ailleurs le SW s'en charge déjà (cf. sw.js).
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(import.meta.env.BASE_URL + "sw.js")
      .then((reg) => {
        // L'app reste ouverte des heures pendant un concert, or le navigateur
        // ne cherche une nouvelle version qu'à la navigation. On vérifie donc
        // nous-mêmes au retour au premier plan, et à intervalle régulier.
        const check = () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        };
        document.addEventListener("visibilitychange", check);
        setInterval(check, 10 * 60 * 1000);
      })
      .catch(() => {
        /* pas de SW (mode privé, http) : l'app fonctionne quand même */
      });
  });
}

const rootEl = document.getElementById("root");
if (!rootEl) {
  showError("mount", "no #root");
} else {
  try {
    ReactDOM.createRoot(rootEl).render(<App />);
  } catch (err) {
    showError("mount", err);
  }
}
