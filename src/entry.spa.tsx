import "./styles.css";
import ReactDOM from "react-dom/client";
import App from "./App";

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

// Register service worker (silent failure — SW is only a PWA nicety)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
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
