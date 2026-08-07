import { AlertTriangle, Banknote, QrCode, ShoppingBag } from "lucide-react";
import { formatEUR } from "../lib/format";
import type { Concert } from "../lib/types";

export function CaisseCard({
  concert,
  totalCents,
  totalItems,
  lowStockCount,
  paymentSplit,
  onTapConcert,
}: {
  concert: Concert;
  totalCents: number;
  totalItems: number;
  lowStockCount: number;
  /** Répartition en centimes ; `unknown` = ventes antérieures au suivi. */
  paymentSplit: { cash: number; qr: number; unknown: number };
  onTapConcert: () => void;
}) {
  const closed = concert.is_closed === true;
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-gradient-to-br from-card via-card to-background">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Concert header */}
      <button
        onClick={onTapConcert}
        className="relative w-full px-4 pt-4 pb-2 flex items-start justify-between text-left"
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Concert actif</div>
          <div className="font-display text-lg text-primary truncate">{concert.name}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(concert.concert_date).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
        <span
          className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded shrink-0 ${
            closed
              ? "bg-muted text-muted-foreground"
              : concert.is_active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {closed ? "Clôturé" : concert.is_active ? "Actif" : "En pause"}
        </span>
      </button>

      {/* Big number */}
      <div className="relative px-4 pb-3">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Caisse</div>
        <div className="font-display text-5xl text-primary leading-none mt-1">{formatEUR(totalCents)}</div>

        {/* Ce qui doit être en espèces dans la boîte, et ce qui est parti en QR. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span className="text-muted-foreground">Cash</span>
            <span className="font-semibold text-foreground">{formatEUR(paymentSplit.cash)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <QrCode className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">QR</span>
            <span className="font-semibold text-foreground">{formatEUR(paymentSplit.qr)}</span>
          </span>
          {paymentSplit.unknown > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-muted-foreground">Non renseigné</span>
              <span className="font-semibold text-muted-foreground">{formatEUR(paymentSplit.unknown)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Footer stats */}
      <div className="relative border-t border-border/60 px-4 py-2 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <ShoppingBag className="h-3 w-3" />
          </div>
          <span className="text-foreground font-semibold">{totalItems}</span>
          <span className="text-muted-foreground">vendu{totalItems > 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${lowStockCount > 0 ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}>
            <AlertTriangle className="h-3 w-3" />
          </div>
          <span className={`font-semibold ${lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {lowStockCount}
          </span>
          <span className="text-muted-foreground">en alerte</span>
        </div>
      </div>
    </div>
  );
}
