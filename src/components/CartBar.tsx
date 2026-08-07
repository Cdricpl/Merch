import { ShoppingCart } from "lucide-react";
import { formatEUR } from "../lib/format";

/**
 * Barre du panier en cours, posée juste au-dessus de la barre d'onglets.
 *
 * Deux zones distinctes et volontairement larges : la gauche ouvre le détail
 * (corriger, mettre une remise), la droite encaisse directement. Le cas courant
 * — un seul article — reste donc à un tap de la feuille de paiement.
 */
export function CartBar({
  count,
  totalCents,
  discounted,
  onOpen,
  onPay,
}: {
  count: number;
  /** Total remise déduite. */
  totalCents: number;
  discounted: boolean;
  onOpen: () => void;
  onPay: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 z-20 px-3"
      style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-stretch gap-2 rounded-2xl bg-card border border-primary/40 shadow-lg shadow-black/40 overflow-hidden">
        <button onClick={onOpen} className="flex items-center gap-3 px-3 py-3 flex-1 min-w-0 text-left active:bg-muted/50">
          <div className="relative shrink-0">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <span className="absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {count}
            </span>
          </div>
          <div className="min-w-0">
            <div className="font-display text-2xl leading-none">{formatEUR(totalCents)}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {discounted ? "Remise appliquée · modifier" : "Voir / modifier"}
            </div>
          </div>
        </button>

        <button
          onClick={onPay}
          className="px-5 bg-primary text-primary-foreground font-display text-xl tracking-wider active:scale-[.97] transition shrink-0"
        >
          Encaisser
        </button>
      </div>
    </div>
  );
}
