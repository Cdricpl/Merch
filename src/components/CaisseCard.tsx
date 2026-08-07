import { useState } from "react";
import { AlertTriangle, Banknote, HelpCircle, QrCode, ShoppingBag } from "lucide-react";
import { formatEUR } from "../lib/format";
import { CAISSE_IMG } from "../lib/assets";
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
  paymentSplit,
  onTapConcert,
}: {
  concert: Concert;
  totalCents: number;
  totalItems: number;
  lowStockCount: number;
  paymentSplit: { cashCents: number; qrCents: number; unknownCents: number };
  onTapConcert: () => void;
}) {
  const closed = concert.is_closed === true;
  const [whole, decimals] = splitAmount(totalCents);
  // Tant qu'aucune photo n'a été déposée dans public/, la carte reste sur son
  // fond uni plutôt que d'afficher une image cassée.
  const [hasPhoto, setHasPhoto] = useState(true);

  return (
    <button
      onClick={onTapConcert}
      className="card-surface relative w-full rounded-2xl overflow-hidden text-left active:opacity-90 transition"
    >
      {hasPhoto && (
        <div className="absolute inset-0 pointer-events-none">
          <img
            src={CAISSE_IMG}
            alt=""
            onError={() => setHasPhoto(false)}
            className="absolute inset-0 w-full h-full object-cover object-right"
          />
          {/* Dégradé vers le noir sur la gauche : c'est lui qui rend le texte
              lisible quelle que soit la photo déposée. */}
          <div className="absolute inset-0 bg-gradient-to-r from-card from-25% via-card/85 via-45% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-card/60 to-transparent" />
        </div>
      )}

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
        <ShoppingBag className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold">{totalItems}</span>
        <span className="text-muted-foreground">vente{totalItems > 1 ? "s" : ""}</span>
      </div>

      <div className="relative border-t border-border px-4 py-2 flex items-center gap-2 text-[13px] w-[60%]">
        <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${lowStockCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
        <span className="font-semibold">{lowStockCount}</span>
        <span className="text-muted-foreground">article{lowStockCount > 1 ? "s" : ""} faible{lowStockCount > 1 ? "s" : ""}</span>
      </div>

      {/* Répartition liquide / QR, sur toute la largeur : c'est le chiffre qu'on
          recoupe en fin de soirée. Fond opaque pour rester lisible par-dessus
          la photo. */}
      <div className="relative border-t border-border bg-card/90 px-4 py-2 flex items-center gap-x-5 gap-y-1 flex-wrap text-[13px]">
        <span className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-ok shrink-0" />
          <span className="text-muted-foreground">Cash</span>
          <span className="font-semibold">{formatEUR(paymentSplit.cashCents)}</span>
        </span>
        <span className="flex items-center gap-2">
          <QrCode className="h-4 w-4 text-primary shrink-0" />
          <span className="text-muted-foreground">QR</span>
          <span className="font-semibold">{formatEUR(paymentSplit.qrCents)}</span>
        </span>
        {/* N'apparaît que s'il reste de vieilles ventes sans moyen de paiement :
            les additionner au cash ferait mentir le total. */}
        {paymentSplit.unknownCents > 0 && (
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Non renseigné</span>
            <span className="font-semibold">{formatEUR(paymentSplit.unknownCents)}</span>
          </span>
        )}
      </div>
    </button>
  );
}
