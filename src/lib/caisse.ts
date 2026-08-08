// La comptabilité de la caisse.
//
// Toute l'arithmétique vit ici, et nulle part ailleurs.
//
// ── Le principe ──────────────────────────────────────────────────────────
// L'argent est soit dans la boîte, soit sur le compte d'un membre.
//   · une vente en liquide et un cachet en liquide ENTRENT dans la boîte ;
//   · un QR et un cachet viré atterrissent chez un membre : ils n'entrent dans
//     la boîte que le jour où il les rend (une « remise ») ;
//   · une dépense en SORT.
//
// ── Recalcul complet ─────────────────────────────────────────────────────
//   solde = solde de départ + TOUS les mouvements connus
//
// Le solde de départ est ce que la boîte contenait avant tout ce que l'app
// enregistre. Rien n'est figé : corriger une vente d'il y a trois mois ou
// inscrire une dépense oubliée remet aussitôt le compte juste.
//
// Contrepartie assumée, et c'est la seule : il faut que TOUT soit saisi. Une
// dépense jamais inscrite fausse le solde en permanence — mais elle le corrige
// dès qu'on l'inscrit, si tard soit-il.
//
// Une version précédente figeait au contraire un « report » au moment d'un
// comptage. Elle comptait alors deux fois tout ce qu'on saisissait ensuite à
// propos du passé. C'est écarté.

import { PAYEES } from "./payment";
import {
  saleTotalCents,
  type Concert, type Expense, type OpeningBalance, type Sale, type Settlement,
} from "./types";

export type MovementKind = "sale" | "fee" | "settlement" | "expense";

/** Une entrée ou une sortie de la boîte, datée. */
export type Movement = {
  key: string;
  at: number;
  kind: MovementKind;
  label: string;
  detail?: string;
  /** Positif : l'argent entre. Négatif : il sort. */
  cents: number;
  /** Colonnes structurées pour l'export : l'affichage se contente du libellé. */
  concert?: string;
  payee?: string;
};

export type PayeeDebt = {
  payee: string;
  /** Ce que ce membre a encaissé (QR + cachet viré). */
  collected: number;
  /** Ce qu'il a déjà remis dans la boîte. */
  settled: number;
  remaining: number;
};

/**
 * Tous les mouvements de la boîte, du plus ancien au plus récent.
 *
 * Les ventes QR n'y figurent pas : cet argent n'a jamais touché la boîte, il
 * n'y entre que par la remise du membre. Les ventes sans moyen de paiement non
 * plus — on ne peut pas deviner où elles sont passées.
 */
export function boxMovements(
  concerts: Concert[],
  sales: Sale[],
  expenses: Expense[],
  settlements: Settlement[],
): Movement[] {
  const nameOf = new Map(concerts.map((c) => [c.id, c.name]));
  const out: Movement[] = [];

  for (const s of sales) {
    if (s.payment_method !== "cash") continue;
    out.push({
      key: `s:${s.id}`,
      at: s.created_at,
      kind: "sale",
      label: nameOf.get(s.concert_id) ?? "Concert supprimé",
      detail: "ventes en liquide",
      cents: saleTotalCents(s),
      concert: nameOf.get(s.concert_id) ?? "Concert supprimé",
    });
  }

  for (const c of concerts) {
    const fee = c.fee_cents ?? 0;
    if (fee <= 0 || c.fee_method === "virement") continue;
    out.push({
      key: `f:${c.id}`,
      // Les cachets saisis avant que la date ne soit enregistrée retombent sur
      // la date du concert : c'est le moment où l'argent a changé de mains.
      at: c.fee_at ?? (Date.parse(c.concert_date) || 0),
      kind: "fee",
      label: c.name,
      detail: "cachet en liquide",
      cents: fee,
      concert: c.name,
    });
  }

  for (const r of settlements) {
    out.push({
      key: `r:${r.id}`,
      at: r.created_at,
      kind: "settlement",
      label: `${r.payee} a remis`,
      cents: r.amount_cents,
      concert: nameOf.get(r.concert_id),
      payee: r.payee,
    });
  }

  for (const e of expenses) {
    out.push({
      key: `e:${e.id}`,
      at: e.created_at,
      kind: "expense",
      label: e.label,
      detail: e.concert_id ? nameOf.get(e.concert_id) : undefined,
      cents: -e.amount_cents,
      concert: e.concert_id ? nameOf.get(e.concert_id) : undefined,
    });
  }

  return out.sort((a, b) => a.at - b.at);
}

/**
 * Le solde de départ retenu, y compris pour une saisie d'une version antérieure.
 *
 * Ces versions enregistraient un comptage, pas un solde de départ. La
 * conversion n'est pas le montant compté mais l'écart : compté moins les
 * mouvements connus à cet instant, c'est-à-dire ce que la boîte contenait
 * avant eux. Prendre le montant compté ferait compter ces mouvements deux fois.
 */
export function openingCents(opening: OpeningBalance | null): number {
  if (!opening) return 0;
  if (typeof opening.cents === "number") return opening.cents;
  if (typeof opening.adjust_cents === "number") return opening.adjust_cents;
  return opening.counted_cents ?? 0;
}

/** Ce que la boîte devrait contenir : le départ, plus tout ce qui a bougé. */
export function boxBalance(movements: Movement[], opening: OpeningBalance | null): number {
  return openingCents(opening) + movements.reduce((n, m) => n + m.cents, 0);
}

/**
 * Regroupe les mouvements pour l'affichage : une ligne par concert pour les
 * ventes, une par membre pour les remises. Les dépenses et les cachets restent
 * détaillés, chacun ayant déjà son propre libellé.
 */
export function summariseMovements(movements: Movement[]): Movement[] {
  const grouped = new Map<string, Movement>();
  for (const m of movements) {
    const key = m.kind === "sale" || m.kind === "settlement" ? `${m.kind}|${m.label}` : m.key;
    const cur = grouped.get(key);
    if (cur) {
      cur.cents += m.cents;
      cur.at = Math.max(cur.at, m.at);
    } else {
      grouped.set(key, { ...m, key });
    }
  }
  return [...grouped.values()].sort((a, b) => b.at - a.at);
}

/**
 * Ce que chaque membre détient encore.
 *
 * Indépendant du comptage : cet argent n'est pas dans la boîte, un comptage de
 * la boîte n'en dit donc rien.
 */
export function payeeDebts(
  concerts: Concert[],
  sales: Sale[],
  settlements: Settlement[],
): PayeeDebt[] {
  const byPayee = new Map<string, PayeeDebt>();
  const debtFor = (payee: string) => {
    let d = byPayee.get(payee);
    if (!d) { d = { payee, collected: 0, settled: 0, remaining: 0 }; byPayee.set(payee, d); }
    return d;
  };

  for (const s of sales) {
    if (s.payment_method !== "qr") continue;
    // Un QR sans nom reste un QR : l'argent n'est pas dans la boîte. On le range
    // sous « ? » plutôt que de le perdre.
    debtFor(s.payment_payee || "?").collected += saleTotalCents(s);
  }
  for (const c of concerts) {
    const fee = c.fee_cents ?? 0;
    if (fee > 0 && c.fee_method === "virement") debtFor(c.fee_payee || "?").collected += fee;
  }
  for (const r of settlements) {
    debtFor(r.payee).settled += r.amount_cents;
  }

  const rank = (p: string) => {
    const i = PAYEES.indexOf(p as (typeof PAYEES)[number]);
    return i === -1 ? PAYEES.length : i;
  };
  return [...byPayee.values()]
    .map((d) => ({ ...d, remaining: d.collected - d.settled }))
    .filter((d) => d.collected !== 0 || d.settled !== 0)
    .sort((a, b) => rank(a.payee) - rank(b.payee) || a.payee.localeCompare(b.payee));
}

/** Ventes d'avant le suivi des paiements : ni liquide, ni QR, donc nulle part. */
export function unknownSalesCents(sales: Sale[]): number {
  let n = 0;
  for (const s of sales) if (!s.payment_method) n += saleTotalCents(s);
  return n;
}

/** Ce que les membres détiennent encore, tous concerts confondus. */
export const totalOwed = (debts: PayeeDebt[]) => debts.reduce((n, d) => n + d.remaining, 0);

/**
 * Ce qu'un membre doit encore, concert par concert.
 *
 * Le bouton « Remis » règle son total d'un geste, mais la remise s'inscrit
 * concert par concert : c'est ce qui garde le détail de chaque soirée juste.
 * Les concerts disparus sont écartés — on ne peut plus rien y inscrire.
 */
export function settlementPlan(
  concerts: Concert[],
  sales: Sale[],
  settlements: Settlement[],
  payee: string,
): Array<{ concertId: string; amountCents: number }> {
  const byConcert = new Map<string, number>();
  const add = (id: string, cents: number) =>
    byConcert.set(id, (byConcert.get(id) ?? 0) + cents);

  for (const s of sales) {
    if (s.payment_method !== "qr" || (s.payment_payee || "?") !== payee) continue;
    add(s.concert_id, saleTotalCents(s));
  }
  for (const c of concerts) {
    const fee = c.fee_cents ?? 0;
    if (fee > 0 && c.fee_method === "virement" && (c.fee_payee || "?") === payee) add(c.id, fee);
  }
  for (const r of settlements) {
    if (r.payee === payee) add(r.concert_id, -r.amount_cents);
  }

  const known = new Set(concerts.map((c) => c.id));
  return [...byConcert.entries()]
    .filter(([id, cents]) => cents > 0 && known.has(id))
    .map(([concertId, amountCents]) => ({ concertId, amountCents }));
}

// ── Export ────────────────────────────────────────────────────────────────

export type LedgerRow = {
  /** Horodatage, 0 pour le solde de départ qui ouvre toujours le tableau. */
  at: number;
  type: string;
  label: string;
  concert?: string;
  payee?: string;
  cents: number;
  /** L'argent passe-t-il par la boîte ? Un QR non remis, par exemple, non. */
  inBox: boolean;
  /** Solde de la boîte après cette ligne. Inchangé sur une ligne hors boîte. */
  balance: number;
};

const TYPE_LABEL: Record<MovementKind, string> = {
  sale: "Vente en liquide",
  fee: "Cachet en liquide",
  settlement: "Remise d'un membre",
  expense: "Dépense",
};

/**
 * Toutes les transactions, pour relecture sur grand écran.
 *
 * Le journal de l'app ne montre que ce qui touche la boîte. Ici on ajoute ce
 * qui n'y passe pas — un QR encaissé par un membre, un cachet viré — parce que
 * c'est justement ce qu'on cherche quand on veut savoir qui doit quoi. La
 * colonne « dans la caisse » les distingue, et le solde n'avance que sur les
 * lignes qui la concernent.
 */
export function ledgerRows(
  concerts: Concert[],
  sales: Sale[],
  expenses: Expense[],
  settlements: Settlement[],
  opening: OpeningBalance | null,
): LedgerRow[] {
  const nameOf = new Map(concerts.map((c) => [c.id, c.name]));
  const rows: Array<Omit<LedgerRow, "balance">> = [];

  for (const m of boxMovements(concerts, sales, expenses, settlements)) {
    rows.push({
      at: m.at,
      type: TYPE_LABEL[m.kind],
      label: m.label,
      concert: m.concert,
      payee: m.payee,
      cents: m.cents,
      inBox: true,
    });
  }

  for (const s of sales) {
    if (s.payment_method === "qr") {
      rows.push({
        at: s.created_at,
        type: "Vente par QR",
        label: nameOf.get(s.concert_id) ?? "Concert supprimé",
        concert: nameOf.get(s.concert_id),
        payee: s.payment_payee || "?",
        cents: saleTotalCents(s),
        inBox: false,
      });
    } else if (!s.payment_method) {
      rows.push({
        at: s.created_at,
        type: "Vente sans moyen de paiement",
        label: nameOf.get(s.concert_id) ?? "Concert supprimé",
        concert: nameOf.get(s.concert_id),
        cents: saleTotalCents(s),
        inBox: false,
      });
    }
  }

  for (const c of concerts) {
    const fee = c.fee_cents ?? 0;
    if (fee > 0 && c.fee_method === "virement") {
      rows.push({
        at: c.fee_at ?? (Date.parse(c.concert_date) || 0),
        type: "Cachet viré à un membre",
        label: c.name,
        concert: c.name,
        payee: c.fee_payee || "?",
        cents: fee,
        inBox: false,
      });
    }
  }

  rows.sort((a, b) => a.at - b.at);

  // Le solde de départ ouvre le tableau : c'est le point d'appui de toute la
  // colonne de soldes.
  let balance = openingCents(opening);
  const out: LedgerRow[] = [{
    at: opening?.created_at ?? 0,
    type: "Solde de départ",
    label: "Avant tout ce qui suit",
    cents: balance,
    inBox: true,
    balance,
  }];

  for (const r of rows) {
    if (r.inBox) balance += r.cents;
    out.push({ ...r, balance });
  }
  return out;
}
