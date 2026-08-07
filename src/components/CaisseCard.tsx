import { AlertTriangle, ShoppingBag } from "lucide-react";
import { formatEUR } from "../lib/format";
import { StageArt } from "./StageArt";
import type { Concert } from "../lib/types";

/** Sépare « 245,00 € » en « 245 » et « ,00 € » : l'unité reste dominante. */
function splitAmount(cents: number): [string, string] {
  const s = formatEUR(cents);
  const i = s.search(/[.,]\d\d/);
  return i === -1 ? [s, ""] : [s.slice(0, i), s.slice(i)];
}

export function CaisseCard({
  concert,
  totalCents,
  totalItems,
  lowStockCount,
  onTapConcert,
}: {
  concert: Concert;
  totalCents: number;
  totalItems: number;
  lowStockCount: number;
  onTapConcert: () => void;
}) {
  const closed = concert.is_closed === true;
  const [whole, decimals] = splitAmount(totalCents);

  return (
    <button
      onClick={onTapConcert}
      className="card-surface relative w-full rounded-2xl overflow-hidden text-left active:opacity-90 transition"
    >
      {/* Visuel de scène sur la moitié droite, fondu vers le texte. */}
      <StageArt className="absolute inset-y-0 right-0 w-[52%] h-full pointer-events-none" />

      <span
        className={`absolute top-3 right-3 z-10 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ${
          closed
            ? "bg-muted text-muted-foreground"
            : concert.is_active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {closed ? "Clôturé" : concert.is_active ? "Actif" : "Pause"}
      </span>

      <div className="relative px-4 pt-3 pb-2.5 w-[60%]">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Caisse</div>
        <div className="mt-1 flex items-baseline text-primary font-display leading-none">
          <span className="text-[2.6rem]">{whole}</span>
          <span className="text-xl">{decimals}</span>
        </div>
      </div>

      <div className="relative border-t border-border px-4 py-2 flex items-center gap-2 text-[13px] w-[60%]">
        <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-semibold">{totalItems}</span>
        <span className="text-muted-foreground">vente{totalItems > 1 ? "s" : ""}</span>
      </div>

      <div className="relative border-t border-border px-4 py-2 flex items-center gap-2 text-[13px] w-[60%]">
        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${lowStockCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
        <span className={lowStockCount > 0 ? "font-semibold text-primary" : "font-semibold"}>{lowStockCount}</span>
        <span className="text-muted-foreground">article{lowStockCount > 1 ? "s" : ""} faible{lowStockCount > 1 ? "s" : ""}</span>
      </div>
    </button>
  );
}
