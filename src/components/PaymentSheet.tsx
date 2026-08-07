import { Banknote, QrCode, X } from "lucide-react";
import { formatEUR } from "../lib/format";
import { CASH, PAYEES, type Payment } from "../lib/payment";
import { useBackHandler } from "../lib/useBackHandler";

/**
 * Dernière étape d'une vente : comment le client a payé.
 *
 * Fermer la feuille annule la vente — c'est la porte de sortie quand on a
 * tapé sur le mauvais article, avant que quoi que ce soit ne soit écrit.
 */
export function PaymentSheet({
  label,
  priceCents,
  onConfirm,
  onCancel,
}: {
  /** Ce qui est vendu, ex. « T-shirt Boris · Homme L ». */
  label: string;
  priceCents: number;
  onConfirm: (payment: Payment) => void;
  onCancel: () => void;
}) {
  useBackHandler(true, onCancel);

  return (
    <div className="fixed inset-0 z-[110] flex items-end bg-black/75 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-4 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Payé comment ?
            </div>
            <div className="font-display text-lg leading-tight truncate">{label}</div>
            <div className="font-display text-3xl text-primary leading-none mt-1">
              {formatEUR(priceCents)}
            </div>
          </div>
          <button onClick={onCancel} aria-label="Annuler" className="p-2 -mr-2 -mt-1 text-muted-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => onConfirm(CASH)}
          className="w-full flex items-center justify-center gap-3 rounded-2xl bg-emerald-600 text-white font-display text-2xl tracking-wider py-5 active:scale-[.98] transition"
        >
          <Banknote className="h-7 w-7" /> Cash
        </button>

        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-1 mb-2">
            QR — vers quel compte ?
          </div>
          <div className="grid grid-cols-2 gap-2">
            {PAYEES.map((p) => (
              <button
                key={p}
                onClick={() => onConfirm({ method: "qr", payee: p })}
                className="flex items-center justify-center gap-2 rounded-2xl bg-muted/60 border border-border font-display text-xl py-4 active:scale-[.98] transition"
              >
                <QrCode className="h-5 w-5 text-primary shrink-0" /> {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
