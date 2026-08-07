import { useMemo } from "react";
import { Check, QrCode } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { caisseFor, caisseTotal, type CaisseState } from "../lib/caisse";
import { CaisseBox } from "../components/CaisseBox";
import type { Concert } from "../lib/types";

/**
 * Le total général : ce que la boîte devrait contenir aujourd'hui, toutes
 * soirées confondues, et qui doit encore de l'argent au groupe.
 *
 * C'est l'écran qui évite de recompter : il additionne tout seul ce qui est
 * entré, ce qui est sorti et ce qui n'est pas encore rentré.
 */
export function CaisseTab() {
  const { concerts, sales, expenses, settlements, loading } = useStore();

  // Un seul passage sur chaque collection pour répartir les lignes par concert,
  // plutôt qu'un filtre complet par concert (qui serait quadratique).
  const perConcert = useMemo(() => {
    const salesBy = new Map<string, typeof sales>();
    for (const s of sales) {
      const a = salesBy.get(s.concert_id);
      if (a) a.push(s); else salesBy.set(s.concert_id, [s]);
    }
    const expBy = new Map<string, typeof expenses>();
    for (const e of expenses) {
      const a = expBy.get(e.concert_id);
      if (a) a.push(e); else expBy.set(e.concert_id, [e]);
    }
    const setBy = new Map<string, typeof settlements>();
    for (const r of settlements) {
      const a = setBy.get(r.concert_id);
      if (a) a.push(r); else setBy.set(r.concert_id, [r]);
    }
    return concerts.map((c) => ({
      concert: c,
      state: caisseFor(c, salesBy.get(c.id) ?? [], expBy.get(c.id) ?? [], setBy.get(c.id) ?? []),
    }));
  }, [concerts, sales, expenses, settlements]);

  const total = useMemo(() => caisseTotal(perConcert.map((r) => r.state)), [perConcert]);

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground">Chargement…</div>;
  }

  if (concerts.length === 0) {
    return (
      <div className="px-6 py-12 text-center space-y-2">
        <h2 className="font-display text-2xl">Caisse vide</h2>
        <p className="text-muted-foreground text-sm">
          Le total apparaîtra dès le premier concert.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pt-1 pb-4 space-y-4">
      <h1 className="font-display text-[22px]">Caisse</h1>

      <CaisseBox state={total} title="Total général" />

      {total.debts.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Par membre, tous concerts
          </div>
          <div className="card-surface rounded-2xl divide-y divide-border">
            {total.debts.map((d) => {
              const done = d.remaining <= 0;
              return (
                <div key={d.payee} className="flex items-center gap-3 px-3 py-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      done ? "bg-ok/20 text-ok" : "bg-warn/20 text-warn"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{d.payee}</div>
                    <div className="text-[11px] text-muted-foreground">
                      encaissé {formatEUR(d.collected)} · remis {formatEUR(d.settled)}
                    </div>
                  </div>
                  <div className={`font-display text-lg shrink-0 ${done ? "text-muted-foreground" : "text-warn"}`}>
                    {done ? "à jour" : formatEUR(d.remaining)}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            Le solde se règle sur la fiche du concert concerné, avec le bouton « Remis ».
          </p>
        </div>
      )}

      <ConcertBreakdown rows={perConcert} />
    </div>
  );
}

function ConcertBreakdown({
  rows,
}: {
  rows: Array<{ concert: Concert; state: CaisseState }>;
}) {
  // Un concert sans le moindre mouvement d'argent n'apprend rien ici.
  const visible = rows.filter(
    (r) => r.state.revenue !== 0 || r.state.expenses !== 0 || r.state.inBox !== 0
  );
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Soirée par soirée
      </div>
      <div className="card-surface rounded-2xl divide-y divide-border">
        {visible.map(({ concert, state }) => (
          <div key={concert.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{concert.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(concert.concert_date).toLocaleDateString("fr-BE", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
                {state.owed > 0 && (
                  <span className="text-warn"> · {formatEUR(state.owed)} en attente</span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-display text-lg leading-none">{formatEUR(state.inBox)}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                en caisse
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
