// Qui doit rembourser quoi.
//
// Le solde de la caisse n'est plus calculé ici : il est tenu à part, sur
// tableur. Ne reste que ce que l'app est seule à savoir — un QR arrive sur le
// compte d'un membre, pas dans la boîte, et un cachet viré fait pareil. Cet
// argent est une dette du membre envers le groupe jusqu'à ce qu'il le remette.

import { PAYEES } from "./payment";
import { saleTotalCents, type Concert, type Sale, type Settlement } from "./types";

export type PayeeDebt = {
  payee: string;
  /** Ce que ce membre a encaissé (QR + cachet viré). */
  collected: number;
  /** Ce qu'il a déjà remis dans la boîte. */
  settled: number;
  remaining: number;
};

const rank = (p: string) => {
  const i = PAYEES.indexOf(p as (typeof PAYEES)[number]);
  return i === -1 ? PAYEES.length : i;
};

/** Ce que chaque membre détient encore. */
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

  return [...byPayee.values()]
    .map((d) => ({ ...d, remaining: d.collected - d.settled }))
    .filter((d) => d.collected !== 0 || d.settled !== 0)
    .sort((a, b) => rank(a.payee) - rank(b.payee) || a.payee.localeCompare(b.payee));
}

/** Ce que les membres détiennent encore, tous concerts confondus. */
export const totalOwed = (debts: PayeeDebt[]) => debts.reduce((n, d) => n + d.remaining, 0);

/**
 * Ce qu'un membre doit encore, concert par concert.
 *
 * Le bouton « Remis » règle son total d'un geste, mais la remise s'inscrit
 * concert par concert : c'est ce qui garde le détail de chaque soirée juste.
 * Les concerts disparus sont écartés — on ne peut plus rien y inscrire.
 *
 * Le plan ne dépasse JAMAIS ce que le membre doit en tout. Une soirée où il a
 * rendu plus qu'il n'avait encaissé vient en déduction des autres : sans ce
 * plafond, un bouton « Remis 50 € » pouvait inscrire les 100 € d'une autre
 * soirée et creuser le trou au lieu de le combler.
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

  let reste = 0;
  for (const cents of byConcert.values()) reste += cents;
  if (reste <= 0) return [];

  const known = new Set(concerts.map((c) => c.id));
  const plan: Array<{ concertId: string; amountCents: number }> = [];
  for (const [concertId, cents] of byConcert) {
    if (cents <= 0 || !known.has(concertId)) continue;
    const amountCents = Math.min(cents, reste);
    plan.push({ concertId, amountCents });
    reste -= amountCents;
    if (reste === 0) break;
  }
  return plan;
}
