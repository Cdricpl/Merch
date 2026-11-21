export type Family = {
  id: string;
  name: string;
  price_cents: number;
  sort_order: number;
  image?: string | null; // data URL (base64), compressed to ~50-100kB
};

export type Variant = {
  id: string;
  family_id: string;
  subcategory?: string | null; // e.g. "Homme", "Femme" — optional secondary dimension
  label: string | null;        // e.g. "S", "M", "2XL", or NULL for single-variant items
  stock: number;
  sort_order: number;
};

export type Concert = {
  id: string;
  name: string;
  concert_date: string;
  is_active: boolean;
  is_closed?: boolean;
  notes: string | null;
  /**
   * Cachet du concert, en centimes. Absent tant qu'il n'a pas été saisi.
   *
   * Payé en liquide, il part directement dans la caisse. Viré sur le compte
   * d'un membre, il se comporte exactement comme un QR : c'est ce membre qui
   * détient l'argent tant qu'il ne l'a pas remis dans la boîte.
   */
  fee_cents?: number;
  fee_method?: "cash" | "virement";
  /**
   * Ancien champ : le membre crédité quand le cachet partait sur un seul
   * compte. Gardé en lecture pour les concerts déjà encodés, et réécrit tant
   * qu'il n'y a qu'un bénéficiaire. `fee_payees` fait foi dès qu'il existe.
   */
  fee_payee?: string | null;
  /**
   * Les membres sur le compte desquels le cachet a été viré.
   *
   * Un organisateur paie souvent le cachet en autant de virements qu'il y a de
   * membres — 40 € à chacun. Le montant se répartit alors à parts égales entre
   * les membres listés ici. Garder la répartition implicite plutôt que de
   * stocker un montant par membre rend impossible un total qui ne retombe pas
   * sur la somme des parts.
   */
  fee_payees?: string[];
  /**
   * Quand le montant a été saisi. Sert à dater la ligne « Cachet » de l'export,
   * pour qu'elle se range à sa place parmi les ventes. Absent sur les cachets
   * d'avant ce suivi : on retombe alors sur la date du concert.
   */
  fee_at?: number;
};

/**
 * Un membre remet dans la boîte ce qu'il a encaissé (QR, ou cachet viré).
 *
 * On enregistre le MONTANT remis, et non un simple « c'est réglé » : une vente
 * QR ajoutée après coup viendrait sinon se cacher derrière une case cochée. Le
 * reste dû se recalcule toujours comme « ce qu'il a encaissé moins ce qu'il a
 * rendu », donc plusieurs remises partielles fonctionnent aussi.
 */
export type Settlement = {
  id: string;
  concert_id: string;
  payee: string;
  amount_cents: number;
  /**
   * Les remises créées d'un même geste partagent cet horodatage : solder un
   * membre écrit une ligne par concert, et « Annuler » doit pouvoir défaire le
   * geste entier, pas seulement sa dernière ligne.
   */
  created_at: number;
};

export type Sale = {
  id: string;
  concert_id: string;
  variant_id: string;
  quantity: number;
  unit_price_cents: number;
  created_at: number; // Date.now() — c'est bien un nombre côté Firestore
  // Optionnels : les ventes enregistrées avant le suivi des paiements n'ont
  // aucun de ces deux champs. Elles sont comptées à part plutôt que rangées
  // d'office en cash, ce qui fausserait les comptes sans prévenir.
  payment_method?: "cash" | "qr";
  payment_payee?: string | null; // nom du membre pour un QR, null en cash
  // Remise : part de la ristourne du panier imputée à cette ligne (en centimes,
  // positive, à soustraire). Absente sur les ventes sans remise.
  discount_cents?: number;
  // Identifiant commun aux lignes d'un même passage en caisse.
  sale_group?: string;
};

/** Ce que la ligne a réellement rapporté, remise déduite. */
export function saleTotalCents(s: Sale): number {
  return s.quantity * s.unit_price_cents - (s.discount_cents ?? 0);
}

/**
 * Les membres crédités du cachet, en retombant sur l'ancien champ unique.
 *
 * Les doublons sont écartés : un même membre listé deux fois recevrait deux
 * parts, et devrait donc le double de ce qu'il a touché.
 */
export function feePayees(c: Concert): string[] {
  const list = (c.fee_payees ?? []).filter((p) => p);
  if (list.length > 0) return [...new Set(list)];
  // Un virement sans nom reste un virement : l'argent n'est pas dans la boîte.
  // On le range sous « ? » plutôt que de le perdre.
  return [c.fee_payee || "?"];
}

/**
 * Qui détient le cachet de ce concert, et combien.
 *
 * Vide pour un cachet en liquide : il est entré dans la boîte, personne ne le
 * doit. Pour un virement, le montant se répartit à parts égales entre les
 * membres crédités, les centimes indivisibles allant aux premiers — la somme
 * des parts retombe donc toujours exactement sur le cachet, à l'euro et au
 * centime près.
 */
export function feeShares(c: Concert): Array<{ payee: string; cents: number }> {
  const fee = c.fee_cents ?? 0;
  if (fee <= 0 || c.fee_method !== "virement") return [];
  const payees = feePayees(c);
  const base = Math.floor(fee / payees.length);
  const extra = fee - base * payees.length;
  return payees.map((payee, i) => ({ payee, cents: base + (i < extra ? 1 : 0) }));
}
