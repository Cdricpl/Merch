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
  fee_payee?: string | null; // le membre crédité, pour un virement
  /**
   * Quand le montant a été saisi. Sert à situer le cachet par rapport au
   * dernier comptage de la caisse. Absent sur les cachets d'avant ce suivi :
   * on retombe alors sur la date du concert.
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
