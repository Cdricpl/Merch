// Capture de l'invite d'installation.
//
// `beforeinstallprompt` est émis par Chrome/Edge/Samsung très tôt — souvent
// avant que React ait monté quoi que ce soit. On l'intercepte donc au niveau
// module (importé depuis entry.spa.tsx) et on le met de côté, sinon l'événement
// est perdu et le bouton « Installer » ne peut plus rien déclencher.

export type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // empêche la mini-infobar native, on affiche la nôtre
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export function getInstallPrompt() {
  return deferred;
}

export function onInstallPromptChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferred) return "unavailable";
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  notify();
  return outcome;
}

/** L'app tourne-t-elle déjà en mode installé (écran d'accueil) ? */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari iOS n'implémente pas display-mode et expose ce booléen à la place
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** iOS n'émet jamais beforeinstallprompt : il faut guider l'utilisateur. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se présente comme un Mac, mais avec un écran tactile
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}
