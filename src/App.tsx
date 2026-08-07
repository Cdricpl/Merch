import { useState } from "react";
import { ShoppingBag, Boxes, Receipt } from "lucide-react";
import { Toaster } from "sonner";
import { StoreProvider } from "./lib/store";
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
  } catch {}
  window.location.reload();
}

export default function App() {
  return (
    <PasscodeGate>
      <StoreProvider>
        <Shell />
        <InstallPrompt />
        <Toaster theme="dark" position="top-center" richColors />
      </StoreProvider>
    </PasscodeGate>
  );
}

function Shell() {
  const [tab, setTab] = useState<Tab>("sales");

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
        <img
          src={LOGO_URL}
          alt="Ardenne Heavy"
          className="h-9 w-auto object-contain"
        />
        <button
          onClick={hardRefresh}
          aria-label="Vider le cache"
          title="Version — tape pour forcer le rechargement"
          className="text-[9px] font-mono text-muted-foreground/60 px-2 py-1 rounded active:bg-muted"
        >
          {__APP_VERSION__}
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {tab === "sales" && <SalesTab />}
        {tab === "stock" && <StockTab />}
        {tab === "concerts" && <ConcertsTab />}
      </main>

      <nav
        className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t border-border z-10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex relative">
          <TabBtn active={tab === "sales"} onClick={() => setTab("sales")} icon={<ShoppingBag className="h-5 w-5" />} label="Ventes" />
          <TabBtn active={tab === "concerts"} onClick={() => setTab("concerts")} icon={<Receipt className="h-5 w-5" />} label="Concerts" />
          <TabBtn active={tab === "stock"} onClick={() => setTab("stock")} icon={<Boxes className="h-5 w-5" />} label="Stock" />
        </div>
      </nav>
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
