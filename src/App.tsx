import { Component, useState, type ReactNode } from "react";
import { ShoppingBag, Boxes, Receipt, RefreshCw } from "lucide-react";
import { Toaster } from "sonner";
import { StoreProvider, useStore } from "./lib/store";
import { SalesTab } from "./tabs/SalesTab";
import { StockTab } from "./tabs/StockTab";
import { ConcertsTab } from "./tabs/ConcertsTab";
import { PasscodeGate } from "./components/PasscodeGate";
import { InstallPrompt } from "./components/InstallPrompt";
import { LOGO_URL } from "./lib/assets";

type Tab = "sales" | "stock" | "concerts";

async function hardRefresh() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Purge best-effort : si le navigateur refuse, le rechargement suffit souvent.
  }
  window.location.reload();
}

/**
 * Sans ça, la moindre erreur de rendu démonte tout l'arbre React : écran vide,
 * plus aucun bouton, et rien d'autre à faire que tuer l'app et la relancer.
 * Ici on garde la main et on propose le rechargement, avec le message d'erreur
 * sous la main — précieux quand le plantage arrive au stand, sans ordinateur.
 */
class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  render() {
    const { err } = this.state;
    if (!err) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-6 text-center bg-background">
        <h1 className="font-display text-2xl text-primary">L'affichage a planté</h1>
        <p className="text-sm text-muted-foreground">
          Les ventes déjà enregistrées sont en sécurité. Recharge pour repartir.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-primary text-primary-foreground font-display text-xl tracking-wider px-8 py-4"
        >
          Recharger
        </button>
        <button onClick={hardRefresh} className="text-xs text-muted-foreground underline">
          Vider le cache et recharger
        </button>
        <pre className="mt-2 max-h-40 w-full overflow-auto text-left text-[10px] text-muted-foreground/70 whitespace-pre-wrap">
          {err.message}
        </pre>
      </div>
    );
  }
}

export default function App() {
  return (
    <PasscodeGate>
      <ErrorBoundary>
        <StoreProvider>
          <Shell />
          <InstallPrompt />
          <Toaster theme="dark" position="top-center" richColors />
        </StoreProvider>
      </ErrorBoundary>
    </PasscodeGate>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("sales");
  const { degraded } = useStore();

  return (
    <div className="min-h-[100dvh] bg-background sm:px-4">
      {/* Hauteur DÉFINIE, pas seulement minimale : sans ça, la colonne grandit
          avec son contenu, `main` ne scrolle jamais tout seul, c'est le document
          entier qui défile — et la barre d'onglets part hors de l'écran. */}
      <div className="app-surface h-[100dvh] max-w-[560px] mx-auto flex flex-col relative overflow-hidden sm:border-x sm:border-border/50">
      <header className="px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 flex items-center justify-between shrink-0 border-b border-border/35">
        <img
          src={LOGO_URL}
          alt="Ardenne Heavy"
          className="h-11 w-auto object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,.7)]"
        />
        <div className="flex items-center gap-2">
          {/* Dire que la connexion se rétablit vaut mieux que laisser croire que
              l'app est figée : les chiffres à l'écran sont justes, ils sont
              simplement en train de rattraper leur retard. */}
          {degraded && (
            <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-500 bg-amber-500/10 px-2 py-1 rounded-full">
              <RefreshCw className="h-3 w-3 animate-spin" /> Reconnexion…
            </span>
          )}
          <button
            onClick={hardRefresh}
            aria-label="Vider le cache"
            title="Version — tape pour forcer le rechargement"
            className="text-[9px] font-mono text-muted-foreground/60 px-2 py-1 rounded active:bg-muted"
          >
            {__APP_VERSION__}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {tab === "sales" && <SalesTab />}
        {tab === "stock" && <StockTab />}
        {tab === "concerts" && <ConcertsTab />}
      </main>

      <nav
        className="sticky bottom-0 mt-auto bg-background/95 backdrop-blur-xl border-t border-border/60 z-10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex relative">
          <TabBtn active={tab === "sales"} onClick={() => setTab("sales")} icon={<ShoppingBag className="h-5 w-5" />} label="Ventes" />
          <TabBtn active={tab === "concerts"} onClick={() => setTab("concerts")} icon={<Receipt className="h-5 w-5" />} label="Concerts" />
          <TabBtn active={tab === "stock"} onClick={() => setTab("stock")} icon={<Boxes className="h-5 w-5" />} label="Stock" />
        </div>
      </nav>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 relative ${active ? "text-primary" : "text-muted-foreground"}`}
    >
      {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />}
      {icon}
      <span className="text-[10px] uppercase tracking-widest font-semibold">{label}</span>
    </button>
  );
}
