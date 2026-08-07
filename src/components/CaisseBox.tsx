import { Wallet } from "lucide-react";
import { formatEUR } from "../lib/format";

/**
 * Le solde de la boîte.
 *
 * Un seul chiffre. Ce qui l'explique vit dans le journal, juste en dessous —
 * pas collé sous le total, où ça faisait du bruit.
 *
 * Les deux mentions qui restent ne détaillent pas le solde, elles le
 * complètent : ce que les membres détiennent n'est PAS dans la boîte, et les
 * vieilles ventes sans moyen de paiement n'y sont pas comptées.
 */
export function CaisseBox({ balance, owed, unknownSales, title = "Solde de la caisse" }: {
  balance: number;
  owed: number;
  unknownSales: number;
  title?: string;
}) {
  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary shrink-0" />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      </div>

      <div className="font-display text-[2.5rem] text-primary leading-none mt-2">
        {formatEUR(balance)}
      </div>

      {owed > 0 && (
        <div className="mt-3 rounded-xl bg-warn/10 border border-warn/30 px-3 py-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-warn">Encore chez les membres</span>
            <span className="font-semibold text-warn">{formatEUR(owed)}</span>
          </div>
        </div>
      )}

      {unknownSales > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {formatEUR(unknownSales)} de ventes sans moyen de paiement, non comptés ici.
        </div>
      )}
    </div>
  );
}
