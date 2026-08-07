import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ArrowDownLeft, Check, ClipboardCheck, Plus, QrCode, Trash2, Undo2, X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { caisseFor, caisseTotal, type CaisseState } from "../lib/caisse";
import {
  createExpense, createSettlements, deleteExpense, deleteSettlements,
  recordCaisseCheck,
} from "../lib/db";
import { useBackHandler } from "../lib/useBackHandler";
import { CaisseBox } from "../components/CaisseBox";
import type { Concert, Expense, Settlement } from "../lib/types";

/**
 * L'écran de l'argent : ce que la boîte devrait contenir, qui doit encore
 * quelque chose, et ce qui est sorti.
 *
 * Tout est réuni ici plutôt qu'éparpillé sur les fiches de concert : on fait
 * ses comptes en une fois, pas soirée par soirée.
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
      if (!e.concert_id) continue;
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

  // Les dépenses saisies sans concert : elles ne figurent dans aucun état de
  // soirée, il faut donc les retrancher du total à part.
  const looseExpenses = useMemo(
    () => expenses.reduce((n, e) => (e.concert_id ? n : n + e.amount_cents), 0),
    [expenses]
  );

  // Seul le comptage le plus récent s'applique ; les précédents restent comme
  // historique. La liste arrive déjà triée du plus récent au plus ancien.
  const adjust = caisseChecks[0]?.adjust_cents ?? 0;
  const lastCheck = caisseChecks[0];

  const total = useMemo(
    () => caisseTotal(perConcert.map((r) => r.state), adjust, looseExpenses),
    [perConcert, adjust, looseExpenses]
  );

  // Ce que l'app compterait sans le report : c'est cette valeur que le prochain
  // comptage doit corriger.
  const withoutAdjust = total.inBox - adjust;

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground">Chargement…</div>;
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

      <MemberDebts total={total} perConcert={perConcert} settlements={settlements} />

      <ExpenseList expenses={expenses} concerts={concerts} />

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
 * Qui détient encore de l'argent, et le bouton qui solde.
 *
 * Un membre peut devoir sur plusieurs soirées à la fois. Le solder soirée par
 * soirée serait absurde — il rend tout d'un coup —, donc le bouton règle son
 * total et écrit dans l'ombre une ligne par concert concerné, ce qui garde le
 * détail juste.
 */
function MemberDebts({
  total, perConcert, settlements,
}: {
  total: CaisseState;
  perConcert: Array<{ concert: Concert; state: CaisseState }>;
  settlements: Settlement[];
}) {
  if (total.debts.length === 0) return null;

  const settle = async (payee: string) => {
    const entries = perConcert
      .map(({ concert, state }) => {
        const d = state.debts.find((x) => x.payee === payee);
        return d && d.remaining > 0
          ? { concertId: concert.id, payee, amountCents: d.remaining }
          : null;
      })
      .filter((x): x is { concertId: string; payee: string; amountCents: number } => x !== null);
    if (entries.length === 0) return;
    try {
      await createSettlements(entries);
      const sum = entries.reduce((n, e) => n + e.amountCents, 0);
      toast.success(`${payee} a remis ${formatEUR(sum)}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const unsettle = async (payee: string) => {
    const mine = settlements.filter((r) => r.payee === payee);
    if (mine.length === 0) return;
    // Défaire le geste entier, pas seulement sa dernière ligne : solder un
    // membre a pu en écrire plusieurs, toutes au même instant.
    const latest = Math.max(...mine.map((r) => r.created_at));
    try {
      await deleteSettlements(mine.filter((r) => r.created_at === latest).map((r) => r.id));
      toast.success("Remise annulée");
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Encaissé par les membres
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
                  encaissé {formatEUR(d.collected)}
                  {d.settled > 0 && <> · remis {formatEUR(d.settled)}</>}
                </div>
              </div>
              {done ? (
                <button
                  onClick={() => unsettle(d.payee)}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-2 active:text-destructive"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Annuler
                </button>
              ) : (
                <button
                  onClick={() => settle(d.payee)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg btn-primary text-[12px] font-semibold px-3 py-2 active:scale-95 transition"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Remis {formatEUR(d.remaining)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ce qui sort de la caisse : achat de matériel, studio, essence, repas… */
function ExpenseList({ expenses, concerts }: { expenses: Expense[]; concerts: Concert[] }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const nameOf = useMemo(() => {
    const m = new Map(concerts.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [concerts]);

  const add = async () => {
    const cents = Math.round(parseFloat(amount.replace(",", ".") || "0") * 100);
    if (!label.trim() || cents <= 0) return;
    setBusy(true);
    try {
      // Saisie depuis la caisse : on ne rattache à aucun concert. Une dépense
      // n'en concerne pas toujours un, et deviner serait pire que ne rien dire.
      await createExpense(null, label.trim(), cents);
      setLabel("");
      setAmount("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await deleteExpense(id); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Dépenses</div>

      {expenses.length > 0 && (
        <div className="card-surface rounded-2xl divide-y divide-border">
          {expenses.map((e) => {
            const concert = nameOf(e.concert_id);
            return (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{e.label}</div>
                  {concert && (
                    <div className="text-[11px] text-muted-foreground truncate">{concert}</div>
                  )}
                </div>
                <div className="font-display text-lg shrink-0">{formatEUR(e.amount_cents)}</div>
                <button
                  onClick={() => remove(e.id)}
                  aria-label="Supprimer la dépense"
                  className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground active:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Achat matériel, studio…"
          className="flex-1 min-w-0 rounded-xl bg-input border border-border px-3 py-2.5 text-sm"
        />
        <input
          type="number" step="1" min={0} inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="€"
          className="w-20 shrink-0 rounded-xl bg-input border border-border px-3 py-2.5 text-sm"
        />
        <button
          onClick={add}
          disabled={busy || !label.trim() || !amount}
          aria-label="Ajouter la dépense"
          className="shrink-0 w-11 rounded-xl btn-primary flex items-center justify-center disabled:opacity-40"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
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
              <span className={delta < 0 ? "text-destructive" : "text-ok"}>
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
