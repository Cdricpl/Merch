import { Wallet } from "lucide-react";
import { formatEUR } from "../lib/format";
import type { CaisseState } from "../lib/caisse";

/**
 * Ce que la boîte doit contenir, et le détail qui y mène.
 *
 * Le détail compte autant que le total : quand le compte physique ne tombe pas
 * juste, c'est en relisant ces lignes qu'on trouve où ça coince. Chaque ligne
 * nulle disparaît pour ne pas noyer les trois qui comptent.
 */
export function CaisseBox({ state, title = "État de la caisse" }: {
  state: CaisseState;
  title?: string;
}) {
  const rows: Array<{ label: string; cents: number; sign: "+" | "−" }> = [];
  if (state.cashSales !== 0) rows.push({ label: "Ventes en liquide", cents: state.cashSales, sign: "+" });
  if (state.feeCash !== 0) rows.push({ label: "Cachet en liquide", cents: state.feeCash, sign: "+" });
  if (state.expenses !== 0) rows.push({ label: "Dépenses", cents: state.expenses, sign: "−" });
  // Ce qui était dans la boîte avant l'app, plus l'écart des comptages. En faire
  // une ligne visible plutôt qu'un total corrigé en douce : c'est la seule façon
  // de comprendre pourquoi la somme des soirées ne fait pas le total.
  if (state.adjust !== 0) {
    rows.push({
      label: "Report du dernier comptage",
      cents: Math.abs(state.adjust),
      sign: state.adjust < 0 ? "−" : "+",
    });
  }

  return (
    <div className="card-surface rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary shrink-0" />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      </div>

      <div className="font-display text-[2.5rem] text-primary leading-none mt-2">
        {formatEUR(state.inBox)}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1.5">
        ce que la boîte devrait contenir
      </div>

      {rows.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-[13px]">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={r.sign === "−" ? "text-destructive" : ""}>
                {r.sign === "−" ? "−" : "+"}
                {formatEUR(r.cents)}
              </span>
            </div>
          ))}
        </div>
      )}

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
