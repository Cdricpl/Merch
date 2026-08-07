import { useEffect, useState } from "react";
import { Download, X, Share, PlusSquare } from "lucide-react";
import {
  getInstallPrompt,
  isIOS,
  isStandalone,
  onInstallPromptChange,
  triggerInstall,
} from "../lib/pwaInstall";

const LS_KEY = "merch:installDismissed";

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(() => getInstallPrompt() !== null);
  const ios = isIOS();

  useEffect(() => onInstallPromptChange(() => setCanPrompt(getInstallPrompt() !== null)), []);

  useEffect(() => {
    // Déjà installée, ou l'utilisateur a dit non une fois : on ne redemande pas.
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(LS_KEY) === "1") return;
    } catch { /* mode privé : on affiche quand même */ }

    // Sur iOS il n'y a pas d'événement à attendre, on montre les instructions.
    // Ailleurs, on attend que le navigateur juge l'app installable.
    if (!ios && !canPrompt) return;

    // Petit délai : laisser l'app se peindre avant de recouvrir l'écran.
    const id = setTimeout(() => setVisible(true), 2500);
    return () => clearTimeout(id);
  }, [ios, canPrompt]);

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(LS_KEY, "1"); } catch { /* mode privé */ }
    setVisible(false);
  };

  const install = async () => {
    const outcome = await triggerInstall();
    if (outcome !== "dismissed") dismiss();
    else setVisible(false); // refus ponctuel : on pourra reproposer plus tard
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end bg-black/70 backdrop-blur-sm" onClick={dismiss}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />

        <div className="flex items-start gap-3">
          <img
            src={import.meta.env.BASE_URL + "icon-192.png"}
            alt=""
            className="w-14 h-14 rounded-2xl shrink-0 shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl leading-tight">Installer l'application</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoute Merchandising à ton écran d'accueil : ouverture instantanée, plein écran,
              et le comptage continue même sans réseau dans la salle.
            </p>
          </div>
          <button onClick={dismiss} aria-label="Fermer" className="p-1 -mr-1 -mt-1 text-muted-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {ios ? (
          <>
            <ol className="space-y-2 text-sm">
              <li className="flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2.5">
                <Share className="h-5 w-5 text-primary shrink-0" />
                <span>
                  Touche <strong>Partager</strong> en bas de Safari
                </span>
              </li>
              <li className="flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2.5">
                <PlusSquare className="h-5 w-5 text-primary shrink-0" />
                <span>
                  Puis <strong>Sur l'écran d'accueil</strong>
                </span>
              </li>
            </ol>
            <button
              onClick={dismiss}
              className="w-full rounded-xl bg-primary text-primary-foreground font-display tracking-wider py-3"
            >
              Compris
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 rounded-xl border border-border py-3 text-sm text-muted-foreground"
            >
              Plus tard
            </button>
            <button
              onClick={install}
              className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-display tracking-wider py-3"
            >
              <Download className="h-4 w-4" /> Installer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
