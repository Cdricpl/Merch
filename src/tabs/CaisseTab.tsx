import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  ArrowDownLeft, Banknote, ClipboardCheck, Plus, QrCode, Trash2, Wallet, X,
} from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import {
  boxBalance, boxMovements, openingCents, payeeDebts, settlementPlan,
  summariseMovements, totalOwed, unknownSalesCents,
  type Movement, type PayeeDebt,
} from "../lib/caisse";
import {
  createExpense, createSettlements, deleteExpense, deleteSettlements,
  setOpeningBalance,
} from "../lib/db";
import { useBackHandler } from "../lib/useBackHandler";
import { CaisseBox } from "../components/CaisseBox";
import type { Concert, Expense, OpeningBalance } from "../lib/types";

const dateFR = (ms: number) =>
  new Date(ms).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" });

/**
 * L'écran de l'argent.
 *
 * Trois questions, dans cet ordre : combien y a-t-il dans la boîte, d'où vient
 * ce chiffre, et qui doit encore quelque chose.
 */
export function CaisseTab() {
  const { concerts, sales, expenses, settlements, openingBalances, loading } = useStore();
  const [openingOpen, setOpeningOpen] = useState(false);

  const movements = useMemo(
    () => boxMovements(concerts, sales, expenses, settlements),
    [concerts, sales, expenses, settlements]
  );
  // Les saisies arrivent du plus récent au plus ancien ; seule la dernière vaut.
  const opening = openingBalances[0] ?? null;
  const balance = useMemo(() => boxBalance(movements, opening), [movements, opening]);

  const debts = useMemo(
    () => payeeDebts(concerts, sales, settlements),
    [concerts, sales, settlements]
  );
  const owed = totalOwed(debts);
  const unknown = useMemo(() => unknownSalesCents(sales), [sales]);

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="px-4 pt-1 pb-4 space-y-4">
      <h1 className="font-display text-[22px]">Caisse</h1>

      <CaisseBox balance={balance} owed={owed} unknownSales={unknown} />

      <button
        onClick={() => setOpeningOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm active:bg-muted/40 transition"
      >
        <ClipboardCheck className="h-4 w-4" />
        {opening ? "Modifier le solde de départ" : "Définir le solde de départ"}
      </button>

      <Journal opening={opening} movements={movements} balance={balance} />

      <MemberDebts
        debts={debts}
        concerts={concerts}
        sales={sales}
        settlements={settlements}
      />

      <ExpenseList expenses={expenses} concerts={concerts} />

      {openingOpen &&
        createPortal(
          <OpeningSheet
            current={openingCents(opening)}
            movementsTotal={balance - openingCents(opening)}
            onClose={() => setOpeningOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}

/**
 * D'où vient le solde.
 *
 * Le solde de départ en pied, tous les mouvements connus au-dessus, du plus
 * récent au plus ancien. Le chiffre se vérifie ligne à ligne au lieu de devoir
 * être cru sur parole.
 */
function Journal({ opening, movements, balance }: {
  opening: OpeningBalance | null;
  movements: Movement[];
  balance: number;
}) {
  const lignes = useMemo(() => summariseMovements(movements), [movements]);
  if (!opening && lignes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Journal de la caisse
      </div>

      <div className="card-surface rounded-2xl divide-y divide-border">
        <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Solde
          </span>
          <span className="font-display text-xl text-primary">{formatEUR(balance)}</span>
        </div>

        {lignes.map((m) => (
          <div key={m.key} className="flex items-center gap-3 px-3 py-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                m.cents < 0 ? "bg-destructive/15 text-destructive" : "bg-ok/15 text-ok"
              }`}
            >
              {m.kind === "expense" ? <Trash2 className="h-4 w-4" />
                : m.kind === "settlement" ? <ArrowDownLeft className="h-4 w-4" />
                : m.kind === "fee" ? <Wallet className="h-4 w-4" />
                : <Banknote className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{m.label}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {m.detail ? `${m.detail} · ` : ""}{dateFR(m.at)}
              </div>
            </div>
            <div className={`font-display text-lg shrink-0 ${m.cents < 0 ? "text-destructive" : ""}`}>
              {m.cents < 0 ? "−" : "+"}{formatEUR(Math.abs(m.cents))}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Solde de départ</div>
            <div className="text-[11px] text-muted-foreground">
              {opening ? "avant tout ce qui est enregistré ici" : "pas encore défini"}
            </div>
          </div>
          <div className="font-display text-lg shrink-0">
            {formatEUR(openingCents(opening))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Qui détient encore de l'argent, et le bouton qui solde.
 *
 * Un membre soldé quitte la liste : il n'y reste que ce qui appelle un geste.
 * L'annulation part donc avec lui, et se rattrape dans la notification — sans
 * quoi une erreur de tap serait sans retour.
 */
function MemberDebts({ debts, concerts, sales, settlements }: {
  debts: PayeeDebt[];
  concerts: Concert[];
  sales: Parameters<typeof settlementPlan>[1];
  settlements: Parameters<typeof settlementPlan>[2];
}) {
  const owing = debts.filter((d) => d.remaining > 0);
  if (owing.length === 0) return null;

  const settle = async (payee: string) => {
    const plan = settlementPlan(concerts, sales, settlements, payee);
    if (plan.length === 0) {
      // Le dû ne vient que de concerts supprimés : il n'y a plus de fiche où
      // inscrire la remise. Le dire vaut mieux qu'un bouton qui ne fait rien.
      toast.error("Ce solde vient d'un concert supprimé : impossible de l'enregistrer.");
      return;
    }
    const sum = plan.reduce((n, e) => n + e.amountCents, 0);
    try {
      const ids = await createSettlements(
        plan.map((e) => ({ concertId: e.concertId, payee, amountCents: e.amountCents }))
      );
      toast.success(`${payee} a remis ${formatEUR(sum)}`, {
        action: {
          label: "Annuler",
          onClick: () => {
            deleteSettlements(ids).catch((e) => toast.error((e as Error).message));
          },
        },
      });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Encaissé par les membres
      </div>
      <div className="card-surface rounded-2xl divide-y divide-border">
        {owing.map((d) => (
          <div key={d.payee} className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-warn/20 text-warn">
              <QrCode className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{d.payee}</div>
              <div className="text-[11px] text-muted-foreground">
                encaissé {formatEUR(d.collected)}
                {d.settled > 0 && <> · remis {formatEUR(d.settled)}</>}
              </div>
            </div>
            <button
              onClick={() => settle(d.payee)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg btn-primary text-[12px] font-semibold px-3 py-2 active:scale-95 transition"
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              Remis {formatEUR(d.remaining)}
            </button>
          </div>
        ))}
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

  // La liste arrive triée du plus récent au plus ancien : les cinq dernières
  // suffisent à vérifier ce qu'on vient de saisir, le reste encombrerait.
  const shown = expenses.slice(0, 5);
  const hidden = expenses.length - shown.length;

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

      {shown.length > 0 && (
        <div className="card-surface rounded-2xl divide-y divide-border">
          {shown.map((e) => {
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
      {hidden > 0 && (
        <p className="text-[11px] text-muted-foreground px-1">
          + {hidden} dépense{hidden > 1 ? "s" : ""} plus ancienne{hidden > 1 ? "s" : ""}.
        </p>
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
 * Saisie du solde de départ.
 *
 * Ce qu'il y avait dans la boîte AVANT tout ce que l'app enregistre. On montre
 * en direct le solde qui en découlera : c'est la seule façon de choisir un
 * chiffre en connaissance de cause, sans avoir à faire la soustraction de tête.
 */
function OpeningSheet({ current, movementsTotal, onClose }: {
  current: number;
  /** Somme de tous les mouvements connus, hors solde de départ. */
  movementsTotal: number;
  onClose: () => void;
}) {
  const [value, setValue] = useState(current ? (current / 100).toString() : "");
  const [busy, setBusy] = useState(false);
  useBackHandler(true, onClose);

  const cents = Math.round(parseFloat(value.replace(",", ".") || "0") * 100);
  const valid = value.trim() !== "" && Number.isFinite(cents) && cents >= 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      await setOpeningBalance(cents);
      toast.success("Solde de départ enregistré");
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
            <h2 className="font-display text-xl">Solde de départ</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Ce qu'il y avait dans la boîte avant tout ce que l'app enregistre.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 -mt-1 text-muted-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="rounded-xl bg-input border border-border px-3 py-2 block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Montant (€)
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
            <span className="text-muted-foreground">Mouvements enregistrés</span>
            <span>{movementsTotal < 0 ? "−" : "+"}{formatEUR(Math.abs(movementsTotal))}</span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-border/60 pt-1.5">
            <span className="text-muted-foreground">Solde affiché</span>
            <span className="font-semibold text-primary">
              {formatEUR((valid ? cents : 0) + movementsTotal)}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Ajuste le montant jusqu'à ce que le solde affiché corresponde à ce que
          contient réellement la boîte.
        </p>

        <button
          onClick={submit}
          disabled={!valid || busy}
          className="w-full rounded-xl btn-primary font-display tracking-wider py-3 disabled:opacity-40"
        >
          {busy ? "…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
