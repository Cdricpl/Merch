import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { formatEUR } from "../lib/format";
import { CAISSE_IMG } from "../lib/assets";
import type { Concert } from "../lib/types";

// Malgré son nom de fichier, cette carte n'affiche pas un solde de caisse :
// c'est la RECETTE du concert en cours, ce que le merch a rapporté ce soir,
// quel que soit le moyen de paiement — dont une partie n'est pas dans la
// boîte. Le solde de la caisse, lui, ne vit plus dans l'app.
//
// La photo est un BANDEAU, elle ne passe plus derrière les chiffres. Avant,
// trois mécanismes de lisibilité s'empilaient pour la rattraper — un dégradé
// latéral, un dégradé vertical et une ombre portée sur chaque texte — et le
// montant tombait quand même sur la caisse claire de la batterie. Un seul
// voile suffit dès lors que le seul texte posé sur l'image est le nom du
// concert ; le reste descend sur le carton, où rien ne le gêne.

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
  paymentSplit,
  onTapConcert,
}: {
  concert: Concert;
  totalCents: number;
  totalItems: number;
  paymentSplit: { cashCents: number; qrCents: number; unknownCents: number };
  onTapConcert: () => void;
}) {
  const closed = concert.is_closed === true;
  const [whole, decimals] = splitAmount(totalCents);
  // Tant qu'aucune photo n'a été déposée dans public/, la carte reste sur son
  // fond uni plutôt que d'afficher une image cassée.
  const [hasPhoto, setHasPhoto] = useState(true);

  return (
    <div className="card-surface rounded-2xl overflow-hidden">
      <button
        onClick={onTapConcert}
        className="relative block w-full text-left active:opacity-90 transition"
        style={{ height: hasPhoto ? "10.5rem" : "auto" }}
      >
        {hasPhoto && (
          <>
            <img
              src={CAISSE_IMG}
              alt=""
              onError={() => setHasPhoto(false)}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: "50% 35%" }}
            />
            {/* Un seul voile, par le bas, juste sous le nom du concert. La
                photo est nocturne : l'assombrir davantage la rendait
                illisible, et c'est tout le groupe qu'on veut voir. */}
            <div className="absolute inset-0 bg-gradient-to-t from-card from-0% via-card/70 via-26% to-transparent to-62%" />
          </>
        )}

        <div
          className={`${hasPhoto ? "absolute inset-x-3.5 bottom-3" : "px-4 pt-3.5 pb-1"} flex items-end gap-2.5`}
        >
          <div className="min-w-0 flex-1">
            <div
              className={`font-display text-[22px] leading-none truncate ${
                closed ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {concert.name}
            </div>
            <div className={`num text-[11px] uppercase tracking-[0.1em] mt-1.5 ${hasPhoto ? "text-foreground/75" : "text-muted-foreground"}`}>
              {new Date(concert.concert_date).toLocaleDateString("fr-BE", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </div>
          </div>
          <span
            className={`shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-md ${
              closed || !concert.is_active
                ? "bg-muted text-muted-foreground"
                : "btn-primary"
            }`}
          >
            {closed ? "Clôturé" : concert.is_active ? "Actif" : "Pause"}
          </span>
        </div>
      </button>

      {/* Le montant vit sur le carton : pleine lisibilité, sans ombre portée. */}
      <div className="px-3.5 py-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recette
          </div>
          <div className="font-display text-primary leading-[0.92] mt-1 flex items-baseline">
            <span className="text-[2.9rem]">{whole}</span>
            <span className="text-xl">{decimals}</span>
          </div>
        </div>
        <div className="text-right pb-1.5 shrink-0">
          <div className="font-display text-2xl leading-none">{totalItems}</div>
          <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mt-0.5">
            vente{totalItems > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Cash et QR à parité, montants alignés à droite : c'est le chiffre
          qu'on recoupe avec la boîte en fin de soirée. */}
      <div className="border-t border-border flex">
        <div className="flex-1 min-w-0 px-3.5 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px] bg-ok shrink-0" />
          <span className="text-[12px] text-muted-foreground">Cash</span>
          <span className="num text-[13px] font-semibold ml-auto">
            {formatEUR(paymentSplit.cashCents)}
          </span>
        </div>
        <div className="w-px bg-border" />
        <div className="flex-1 min-w-0 px-3.5 py-2.5 flex items-center gap-2">
          <span className="w-2 h-2 rounded-[2px] bg-primary shrink-0" />
          <span className="text-[12px] text-muted-foreground">QR</span>
          <span className="num text-[13px] font-semibold ml-auto">
            {formatEUR(paymentSplit.qrCents)}
          </span>
        </div>
      </div>

      {/* N'apparaît que s'il reste de vieilles ventes sans moyen de paiement :
          les additionner au cash ferait mentir le total. */}
      {paymentSplit.unknownCents > 0 && (
        <div className="border-t border-border px-3.5 py-2.5 flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-[12px] text-muted-foreground">Non renseigné</span>
          <span className="num text-[13px] font-semibold ml-auto">
            {formatEUR(paymentSplit.unknownCents)}
          </span>
        </div>
      )}
    </div>
  );
}
