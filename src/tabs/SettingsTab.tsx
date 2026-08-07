import { useState } from "react";
import { toast } from "sonner";
import { Download, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useStore } from "../lib/store";
import { seedInitialStock } from "../lib/db";
import { hardRefresh } from "../App";

export function SettingsTab() {
  const { families, variants, sales, concerts, degraded } = useStore();
  const [seeding, setSeeding] = useState(false);

  const doSeed = async () => {
    if (families.length > 0 && !confirm("Le stock initial va être ajouté EN PLUS des produits existants. Continuer ?")) return;
    setSeeding(true);
    try {
      await seedInitialStock();
      toast.success("Stock initial chargé");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="px-4 pt-1 pb-6 space-y-4">
      <h1 className="font-display text-[22px]">Paramètres</h1>

      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Connexion</h2>
        <div className="card-surface rounded-2xl px-3.5 py-3 flex items-center gap-3">
          {degraded ? (
            <WifiOff className="h-4 w-4 text-warn shrink-0" />
          ) : (
            <Wifi className="h-4 w-4 text-ok shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium">
              {degraded ? "Reconnexion en cours" : "Synchronisé"}
            </div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              {degraded
                ? "Les ventes saisies sont conservées et repartiront toutes seules."
                : "Les ventes s'écrivent en direct sur tous les téléphones."}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Contenu</h2>
        <div className="card-surface rounded-2xl divide-y divide-border">
          <Row label="Produits" value={String(families.length)} />
          <Row label="Tailles / variantes" value={String(variants.length)} />
          <Row label="Concerts" value={String(concerts.length)} />
          <Row label="Ventes enregistrées" value={String(sales.length)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Actions</h2>

        <button
          onClick={doSeed}
          disabled={seeding}
          className="card-surface w-full rounded-2xl px-3.5 py-3 flex items-center gap-3 text-left active:opacity-80 disabled:opacity-50"
        >
          <Download className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium">{seeding ? "Chargement…" : "Charger le stock initial"}</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Recrée les CD et t-shirts avec les quantités de départ.
            </div>
          </div>
        </button>

        <button
          onClick={hardRefresh}
          className="card-surface w-full rounded-2xl px-3.5 py-3 flex items-center gap-3 text-left active:opacity-80"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium">Vider le cache et recharger</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              À utiliser si l'app semble bloquée sur une ancienne version.
            </div>
          </div>
        </button>
      </section>

      <p className="text-center text-[11px] text-muted-foreground pt-2">
        Ardenne Heavy — Merch · {__APP_VERSION__}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-3">
      <span className="text-[14px] text-muted-foreground">{label}</span>
      <span className="font-display text-[17px]">{value}</span>
    </div>
  );
}
