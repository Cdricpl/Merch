import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ShoppingBag, Boxes, Receipt } from "lucide-react";
import { SalesTab } from "@/components/SalesTab";
import { InventoryTab } from "@/components/InventoryTab";
import { ConcertsTab } from "@/components/ConcertsTab";
import { BAND_ID, BAND_NAME } from "@/lib/band";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export const Route = createFileRoute("/")({ component: Index });

type Tab = "sales" | "inventory" | "concerts";

function Index() {
  const [tab, setTab] = useState<Tab>("sales");
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <h1 className="font-display text-lg leading-none text-primary">{BAND_NAME}</h1>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">Merch counter</p>
      </header>

      {!isOnline && (
        <div className="bg-amber-950/80 text-amber-300 text-xs text-center py-1.5 px-4 border-b border-amber-900/60">
          Hors-ligne — données en cache
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24">
        {tab === "sales" && <SalesTab bandId={BAND_ID} onNavigateToConcerts={() => setTab("concerts")} />}
        {tab === "inventory" && <InventoryTab bandId={BAND_ID} />}
        {tab === "concerts" && <ConcertsTab bandId={BAND_ID} />}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-card border-t border-border z-10" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="flex">
          <TabBtn active={tab === "sales"} onClick={() => setTab("sales")} icon={<ShoppingBag className="h-5 w-5" />} label="Ventes" />
          <TabBtn active={tab === "inventory"} onClick={() => setTab("inventory")} icon={<Boxes className="h-5 w-5" />} label="Stock" />
          <TabBtn active={tab === "concerts"} onClick={() => setTab("concerts")} icon={<Receipt className="h-5 w-5" />} label="Recettes" />
        </div>
      </nav>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${active ? "text-primary" : "text-muted-foreground"}`}>
      {icon}
      <span className="text-[11px] uppercase tracking-wider font-semibold">{label}</span>
    </button>
  );
}
