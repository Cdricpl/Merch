import { Minus, Plus, Trash2, X } from "lucide-react";
import { formatEUR } from "../lib/format";
import { cartSubtotal, type CartLine } from "../lib/cart";
import { useBackHandler } from "../lib/useBackHandler";

// Ristournes proposées d'un tap. Volontairement pas de champ libre : au stand,
// dans le bruit et avec les mains prises, ouvrir un clavier numérique coûte plus
// cher que de taper deux fois « −5 ». Les paliers se cumulent.
const STEPS = [100, 200, 500, 1000];

export function CartSheet({
  cart,
  discountCents,
  onAdd,
  onRemove,
  onDrop,
  onDiscountChange,
  onClear,
  onPay,
  onClose,
}: {
  cart: CartLine[];
  discountCents: number;
  onAdd: (variantId: string) => void;
  onRemove: (variantId: string) => void;
  onDrop: (variantId: string) => void;
  onDiscountChange: (cents: number) => void;
  onClear: () => void;
  onPay: () => void;
  onClose: () => void;
}) {
  useBackHandler(true, onClose);

  const subtotal = cartSubtotal(cart);
  const discount = Math.min(discountCents, subtotal);
  const toPay = subtotal - discount;

  return (
    <div className="fixed inset-0 z-[100] flex items-end bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-4 space-y-4 max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />

        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Panier</h2>
          <div className="flex items-center gap-1">
            <button onClick={onClear} className="text-xs text-muted-foreground px-2 py-2 active:text-destructive">
              Tout vider
            </button>
            <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <ul className="space-y-2">
          {cart.map((l) => (
            <li key={l.variantId} className="flex items-center gap-2 bg-muted/50 rounded-xl p-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{l.label}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatEUR(l.unitPriceCents)} × {l.qty} = {formatEUR(l.unitPriceCents * l.qty)}
                </div>
              </div>
              <button
                onClick={() => onRemove(l.variantId)}
                aria-label="Retirer un"
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center active:scale-90 transition shrink-0"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-display text-xl w-6 text-center shrink-0">{l.qty}</span>
              <button
                onClick={() => onAdd(l.variantId)}
                aria-label="Ajouter un"
                className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition shrink-0"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDrop(l.variantId)}
                aria-label="Supprimer la ligne"
                className="w-9 h-10 flex items-center justify-center text-muted-foreground active:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* Remise */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Remise</span>
            {discount > 0 && (
              <button onClick={() => onDiscountChange(0)} className="text-xs text-muted-foreground active:text-destructive">
                Annuler la remise
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s) => (
              <button
                key={s}
                onClick={() => onDiscountChange(Math.min(subtotal, discount + s))}
                disabled={discount >= subtotal}
                className="rounded-xl bg-muted/60 border border-border font-display text-lg py-3 active:scale-[.97] transition disabled:opacity-30"
              >
                −{s / 100} €
              </button>
            ))}
          </div>
        </div>

        {/* Totaux */}
        <div className="rounded-2xl bg-muted/40 border border-border/60 p-3 space-y-1">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Sous-total</span>
            <span>{formatEUR(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-500">
              <span>Remise</span>
              <span>−{formatEUR(discount)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">À payer</span>
            <span className="font-display text-4xl text-primary leading-none">{formatEUR(toPay)}</span>
          </div>
        </div>

        <button
          onClick={onPay}
          disabled={cart.length === 0}
          className="w-full rounded-2xl primary-action text-primary-foreground font-display text-2xl tracking-wider py-4 active:scale-[.98] transition disabled:opacity-40"
        >
          Encaisser
        </button>
      </div>
    </div>
  );
}
