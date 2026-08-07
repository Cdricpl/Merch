import { Component, useMemo, useState, type ReactNode } from "react";
import { ShoppingCart, Flame, Boxes, BarChart3, Settings, Bell } from "lucide-react";
import { Toaster } from "sonner";
import { StoreProvider, useStore } from "./lib/store";
import { ActiveConcertProvider, useActiveConcert } from "./lib/activeConcert";
import { SalesTab } from "./tabs/SalesTab";
import { StockTab } from "./tabs/StockTab";
import { ConcertsTab } from "./tabs/ConcertsTab";
import { StatsTab } from "./tabs/StatsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { PasscodeGate } from "./components/PasscodeGate";
import { InstallPrompt } from "./components/InstallPrompt";
import { LOGO_URL } from "./lib/assets";
import { RED_MAX } from "./lib/stockLevel";

type Tab = "sales" | "concerts" | "stock" | "stats" | "settings";

export async function hardRefresh() {
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
          className="btn-primary rounded-xl font-display text-xl tracking-wider px-8 py-4"
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
          <ActiveConcertProvider>
            <Shell />
            <InstallPrompt />
            <Toaster theme="dark" position="top-center" richColors />
          </ActiveConcertProvider>
        </StoreProvider>
      </ErrorBoundary>
    </PasscodeGate>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("sales");
  // Arriver sur Stock avec le formulaire « nouveau produit » déjà ouvert se fait
  // en remontant l'onglet (la clé change) plutôt qu'avec un effet : l'état
  // initial rejoué suffit, sans rendu en cascade.
  const [stockKey, setStockKey] = useState(0);
  const [addProduct, setAddProduct] = useState(false);
  const { variants, degraded } = useStore();
  const { concert } = useActiveConcert();

  // Nombre de TAILLES dans le rouge : le cumul d'une famille ne descend jamais
  // assez bas pour alerter, alors qu'une taille à 1 doit se voir.
  const lowStockCount = useMemo(
    () => variants.reduce((n, v) => n + (v.stock <= RED_MAX ? 1 : 0), 0),
    [variants]
  );

  const goStock = () => { setAddProduct(false); setStockKey((k) => k + 1); setTab("stock"); };
  const goAddProduct = () => { setAddProduct(true); setStockKey((k) => k + 1); setTab("stock"); };

  return (
    <div className="min-h-[100dvh] bg-background sm:px-4">
      {/* Hauteur DÉFINIE, pas seulement minimale : sans ça, la colonne grandit
          avec son contenu, `main` ne scrolle jamais tout seul, c'est le document
          entier qui défile — et la barre d'onglets part hors de l'écran. */}
      <div className="h-[100dvh] max-w-[560px] mx-auto flex flex-col relative overflow-hidden sm:border-x sm:border-border">
        <header className="px-4 pt-[max(0.875rem,env(safe-area-inset-top))] pb-3 shrink-0">
          {/* Logo centré sur la largeur : la cloche est posée par-dessus, à
              droite, pour qu'elle ne décale pas le centrage. */}
          <div className="relative flex items-center justify-center">
            <img src={LOGO_URL} alt="Ardenne Heavy" className="h-10 w-auto object-contain" />

            <div className="absolute right-0 inset-y-0 flex items-center gap-1">
              {/* Dire que la connexion se rétablit vaut mieux que laisser croire
                  que l'app est figée : les chiffres affichés sont justes, ils
                  rattrapent simplement leur retard. */}
              {degraded && (
                <span className="text-[10px] text-warn bg-warn/10 px-2 py-1 rounded-full">Reconnexion…</span>
              )}
              <button
                onClick={goStock}
                aria-label={`Stock faible : ${lowStockCount} taille${lowStockCount > 1 ? "s" : ""}`}
                className="relative p-2 -mr-2 text-foreground active:opacity-60"
              >
                <Bell className="h-[22px] w-[22px]" />
                {lowStockCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                )}
              </button>
            </div>
          </div>

          {concert && (
            <div className="mt-2 text-center">
              <div className="font-display text-[16px] leading-none text-primary truncate">
                {concert.name}
              </div>
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground mt-1">
                {new Date(concert.concert_date).toLocaleDateString("fr-BE", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">
          {tab === "sales" && <SalesTab onAddProduct={goAddProduct} />}
          {tab === "concerts" && <ConcertsTab />}
          {tab === "stock" && <StockTab key={stockKey} initialAddOpen={addProduct} />}
          {tab === "stats" && <StatsTab />}
          {tab === "settings" && <SettingsTab />}
        </main>

        <nav
          className="shrink-0 bg-background border-t border-border"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex">
            <TabBtn active={tab === "sales"} onClick={() => setTab("sales")} icon={<ShoppingCart />} label="Ventes" />
            <TabBtn active={tab === "concerts"} onClick={() => setTab("concerts")} icon={<Flame />} label="Concerts" />
            <TabBtn active={tab === "stock"} onClick={goStock} icon={<Boxes />} label="Stock" />
            <TabBtn active={tab === "stats"} onClick={() => setTab("stats")} icon={<BarChart3 />} label="Stats" />
            <TabBtn active={tab === "settings"} onClick={() => setTab("settings")} icon={<Settings />} label="Paramètres" />
          </div>
        </nav>
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 flex flex-col items-center justify-center pt-2.5 pb-2 gap-1.5 relative ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-0.5 rounded-full bg-primary" />}
      <span className="[&>svg]:h-[19px] [&>svg]:w-[19px]">{icon}</span>
      <span className="text-[8.5px] uppercase tracking-[0.08em] font-semibold truncate max-w-full px-0.5">
        {label}
      </span>
    </button>
  );
}
