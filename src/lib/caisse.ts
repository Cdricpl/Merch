// Ce que la boîte doit contenir, et qui doit encore de l'argent.
//
// Toute l'arithmétique de la caisse vit ici, et nulle part ailleurs : c'est le
// seul moyen que la fiche d'un concert et le total général ne finissent pas par
// raconter deux histoires différentes.
//
// Le principe tient en une phrase : l'argent est soit dans la boîte, soit sur
// le compte d'un membre. Une vente en liquide et un cachet en liquide entrent
// dans la boîte ; un QR et un cachet viré atterrissent chez un membre et n'y
// entrent que le jour où il les rend (une « remise »). Les dépenses en sortent.

import { PAYEES } from "./payment";
import { saleTotalCents, type Concert, type Expense, type Sale, type Settlement } from "./types";

export type PayeeDebt = {
  payee: string;
  /** Ce que ce membre a encaissé pour ce concert (QR + cachet viré). */
  collected: number;
  /** Ce qu'il a déjà remis dans la boîte. */
  settled: number;
  /** Ce qu'il doit encore. Négatif si trop remis — on l'affiche tel quel. */
  remaining: number;
};

export type CaisseState = {
  /** Ventes encaissées en liquide. */
  cashSales: number;
  /** Cachet reçu en liquide. */
  feeCash: number;
  /** Remises : ce que les membres ont rendu. */
  settled: number;
  /** Sorties d'argent. */
  expenses: number;
  /** Ce que la boîte doit contenir. */
  inBox: number;
  /** Total encore détenu par les membres. */
  owed: number;
  debts: PayeeDebt[];
  /**
   * Ventes d'avant le suivi des paiements. Elles ne sont rangées ni en liquide
   * ni en QR, donc pas comptées dans la boîte : on ne peut pas deviner où cet
   * argent est passé, et l'inventer ferait mentir le total.
   */
  unknownSales: number;
  /** Recette du concert : ventes + cachet, quel que soit le mode. */
  revenue: number;
};

const EMPTY_DEBT = (payee: string): PayeeDebt => ({
  payee, collected: 0, settled: 0, remaining: 0,
});

/**
 * État de la caisse pour UN concert.
 *
 * Les tableaux reçus doivent déjà être filtrés sur ce concert : le filtrage est
 * laissé à l'appelant, qui le fait une seule fois pour tous les concerts quand
 * il calcule le total général.
 */
export function caisseFor(
  concert: Concert,
  sales: Sale[],
  expenses: Expense[],
  settlements: Settlement[],
): CaisseState {
  let cashSales = 0;
  let unknownSales = 0;
  let salesTotal = 0;

  const byPayee = new Map<string, PayeeDebt>();
  const debtFor = (payee: string) => {
    let d = byPayee.get(payee);
    if (!d) { d = EMPTY_DEBT(payee); byPayee.set(payee, d); }
    return d;
  };

  for (const s of sales) {
    const cents = saleTotalCents(s);
    salesTotal += cents;
    if (s.payment_method === "cash") {
      cashSales += cents;
    } else if (s.payment_method === "qr") {
      // Un QR sans nom de membre reste un QR : l'argent n'est pas dans la boîte.
      // On le range sous « ? » plutôt que de le perdre.
      debtFor(s.payment_payee || "?").collected += cents;
    } else {
      unknownSales += cents;
    }
  }

  const fee = concert.fee_cents ?? 0;
  let feeCash = 0;
  if (fee > 0) {
    if (concert.fee_method === "virement") {
      debtFor(concert.fee_payee || "?").collected += fee;
    } else {
      // Par défaut le cachet est du liquide : c'est le cas courant, et un
      // cachet saisi sans mode précisé est bien dans la boîte.
      feeCash += fee;
    }
  }

  let settled = 0;
  for (const r of settlements) {
    settled += r.amount_cents;
    debtFor(r.payee).settled += r.amount_cents;
  }

  let expensesTotal = 0;
  for (const e of expenses) expensesTotal += e.amount_cents;

  let owed = 0;
  for (const d of byPayee.values()) {
    d.remaining = d.collected - d.settled;
    owed += d.remaining;
  }

  // Ordre stable : les membres connus d'abord, dans l'ordre de PAYEES, puis
  // tout nom inattendu (ancien membre, QR sans nom).
  const rank = (p: string) => {
    const i = PAYEES.indexOf(p as (typeof PAYEES)[number]);
    return i === -1 ? PAYEES.length : i;
  };
  const debts = [...byPayee.values()]
    .filter((d) => d.collected !== 0 || d.settled !== 0)
    .sort((a, b) => rank(a.payee) - rank(b.payee) || a.payee.localeCompare(b.payee));

  return {
    cashSales,
    feeCash,
    settled,
    expenses: expensesTotal,
    inBox: cashSales + feeCash + settled - expensesTotal,
    owed,
    debts,
    unknownSales,
    revenue: salesTotal + fee,
  };
}

/** Somme des états de tous les concerts : le contenu réel de la boîte. */
export function caisseTotal(states: CaisseState[]): CaisseState {
  const merged = new Map<string, PayeeDebt>();
  const out: CaisseState = {
    cashSales: 0, feeCash: 0, settled: 0, expenses: 0,
    inBox: 0, owed: 0, debts: [], unknownSales: 0, revenue: 0,
  };

  for (const s of states) {
    out.cashSales += s.cashSales;
    out.feeCash += s.feeCash;
    out.settled += s.settled;
    out.expenses += s.expenses;
    out.inBox += s.inBox;
    out.owed += s.owed;
    out.unknownSales += s.unknownSales;
    out.revenue += s.revenue;
    for (const d of s.debts) {
      const m = merged.get(d.payee) ?? EMPTY_DEBT(d.payee);
      m.collected += d.collected;
      m.settled += d.settled;
      m.remaining += d.remaining;
      merged.set(d.payee, m);
    }
  }

  const rank = (p: string) => {
    const i = PAYEES.indexOf(p as (typeof PAYEES)[number]);
    return i === -1 ? PAYEES.length : i;
  };
  out.debts = [...merged.values()].sort(
    (a, b) => rank(a.payee) - rank(b.payee) || a.payee.localeCompare(b.payee)
  );
  return out;
}
