import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Check, ClipboardCheck, QrCode, X } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { caisseFor, caisseTotal, type CaisseState } from "../lib/caisse";
import { recordCaisseCheck } from "../lib/db";
import { useBackHandler } from "../lib/useBackHandler";
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
  const { concerts, sales, expenses, settlements, caisseChecks, loading } = useStore();
  const [countOpen, setCountOpen] = useState(false);

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

  // Seul le comptage le plus récent s'applique ; les précédents restent comme
  // historique. La liste arrive déjà triée du plus récent au plus ancien.
  const adjust = caisseChecks[0]?.adjust_cents ?? 0;
  const lastCheck = caisseChecks[0];

  const total = useMemo(
    () => caisseTotal(perConcert.map((r) => r.state), adjust),
    [perConcert, adjust]
  );

  // Ce que l'app compterait sans le report : c'est cette valeur que le prochain
  // comptage doit corriger.
  const withoutAdjust = total.inBox - adjust;

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

      <button
        onClick={() => setCountOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm active:bg-muted/40 transition"
      >
        <ClipboardCheck className="h-4 w-4" /> J'ai compté la caisse
      </button>
      {lastCheck && (
        <p className="text-[11px] text-muted-foreground -mt-2 px-1">
          Dernier comptage : {formatEUR(lastCheck.counted_cents)} le{" "}
          {new Date(lastCheck.created_at).toLocaleDateString("fr-BE", {
            day: "2-digit", month: "long", year: "numeric",
          })}.
        </p>
      )}

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

      {countOpen &&
        createPortal(
          <CountSheet
            claimed={total.inBox}
            raw={withoutAdjust}
            onClose={() => setCountOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}

/**
 * Comptage réel de la boîte.
 *
 * L'app additionne ce qu'elle connaît, mais la boîte contenait déjà de l'argent
 * avant qu'elle n'existe. Plutôt que de demander une « somme de départ » — un
 * chiffre que personne ne retrouve jamais — on demande ce qu'il y a MAINTENANT,
 * et on en déduit l'écart. Le total repart de la réalité.
 */
function CountSheet({ claimed, raw, onClose }: {
  /** Ce que l'app affiche aujourd'hui, report compris — la valeur à comparer. */
  claimed: number;
  /** La même chose SANS le report : c'est elle que le nouvel écart corrige. */
  raw: number;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  useBackHandler(true, onClose);

  const counted = Math.round(parseFloat(value.replace(",", ".") || "0") * 100);
  const valid = value.trim() !== "" && Number.isFinite(counted) && counted >= 0;
  // L'écart montré est celui qui parle : la dérive depuis le dernier comptage.
  // Le report enregistré, lui, se calcule sur la valeur brute — sinon le report
  // précédent serait compté deux fois.
  const delta = counted - claimed;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await recordCaisseCheck(counted, raw);
      toast.success("Caisse recalée");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-xl">Comptage de la caisse</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Compte les billets et les pièces, et saisis le total.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 -mt-1 text-muted-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="rounded-xl bg-input border border-border px-3 py-2 block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Montant compté (€)
          </div>
          <input
            type="number" step="0.01" min={0} inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="0,00"
            autoFocus
            className="w-full bg-transparent text-3xl font-display outline-none"
          />
        </label>

        <div className="rounded-xl bg-muted/40 border border-border/60 p-3 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">L'app comptait</span>
            <span>{formatEUR(claimed)}</span>
          </div>
          {valid && (
            <div className="flex items-center justify-between text-sm border-t border-border/60 pt-1.5">
              <span className="text-muted-foreground">Écart</span>
              <span className={delta === 0 ? "text-ok" : delta > 0 ? "text-ok" : "text-destructive"}>
                {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                {formatEUR(Math.abs(delta))}
              </span>
            </div>
          )}
        </div>

        {valid && delta !== 0 && (
          <p className="text-[11px] text-muted-foreground">
            L'écart est retenu comme report : à partir de maintenant, le total
            part de {formatEUR(counted)} et les ventes s'y ajoutent.
          </p>
        )}

        <button
          onClick={submit}
          disabled={!valid || busy}
          className="w-full rounded-xl btn-primary font-display tracking-wider py-3 disabled:opacity-40"
        >
          {busy ? "…" : "Enregistrer le comptage"}
        </button>
      </div>
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
