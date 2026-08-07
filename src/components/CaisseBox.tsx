import { Wallet } from "lucide-react";
import { formatEUR } from "../lib/format";
import type { CaisseState } from "../lib/caisse";

/**
 * Ce que la boîte doit contenir.
 *
 * Un seul chiffre, sans le détail qui y mène. Il reste calculé de la même
 * façon — ventes en liquide, cachet en liquide et remises, moins les dépenses,
 * plus le report du dernier comptage — mais l'écran n'affiche que le résultat.
 *
 * Restent deux mentions, qui ne détaillent pas le total mais le complètent :
 * ce que les membres détiennent encore, qui n'est PAS dans la boîte, et les
 * vieilles ventes sans moyen de paiement, qui n'y sont pas comptées.
 */
export function CaisseBox({ state, title = "État de la caisse" }: {
  state: CaisseState;
  title?: string;
}) {
  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary shrink-0" />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      </div>

      <div className="font-display text-[2.5rem] text-primary leading-none mt-2">
        {formatEUR(state.inBox)}
      </div>

      {state.owed > 0 && (
        <div className="mt-3 rounded-xl bg-warn/10 border border-warn/30 px-3 py-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-warn">Encore chez les membres</span>
            <span className="font-semibold text-warn">{formatEUR(state.owed)}</span>
          </div>
        </div>
      )}

      {/* Cet argent existe, mais on ne sait pas où il est passé : le passer sous
          silence donnerait un total faussement rassurant. */}
      {state.unknownSales > 0 && (
        <div className="mt-2 text-[11px] text-muted-foreground">
          {formatEUR(state.unknownSales)} de ventes sans moyen de paiement, non comptés ici.
        </div>
      )}
    </div>
  );
}
