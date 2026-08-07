// Panier d'une vente en cours.
//
// Rien n'est écrit dans Firestore tant que le paiement n'est pas validé : le
// panier vit uniquement dans l'état du composant Ventes. On peut donc y corriger
// une erreur librement, et le fermer sans laisser de trace.

import type { Family, Variant } from "./types";

export type CartLine = {
  variantId: string;
  familyId: string;
  /** « T-shirt Boris · Homme L » — figé au moment de l'ajout, pour l'affichage. */
  label: string;
  unitPriceCents: number;
  qty: number;
};

/** « T-shirt Boris · Homme L », ou juste le nom pour un article sans taille. */
export function lineLabel(family: Family, variant: Variant): string {
  const parts = [variant.subcategory, variant.label].filter(Boolean);
  return parts.length > 0 ? `${family.name} · ${parts.join(" ")}` : family.name;
}

export function cartCount(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty, 0);
}

export function cartSubtotal(cart: CartLine[]): number {
  return cart.reduce((n, l) => n + l.qty * l.unitPriceCents, 0);
}

/** Quantités déjà au panier, par variante — sert à ne pas vendre à découvert. */
export function cartByVariant(cart: CartLine[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of cart) m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.qty);
  return m;
}

export function addLine(cart: CartLine[], family: Family, variant: Variant): CartLine[] {
  const i = cart.findIndex((l) => l.variantId === variant.id);
  if (i === -1) {
    return [
      ...cart,
      {
        variantId: variant.id,
        familyId: family.id,
        label: lineLabel(family, variant),
        unitPriceCents: family.price_cents,
        qty: 1,
      },
    ];
  }
  return cart.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
}

/** Retire une unité ; la ligne disparaît quand elle tombe à zéro. */
export function removeOne(cart: CartLine[], variantId: string): CartLine[] {
  return cart
    .map((l) => (l.variantId === variantId ? { ...l, qty: l.qty - 1 } : l))
    .filter((l) => l.qty > 0);
}

export function dropLine(cart: CartLine[], variantId: string): CartLine[] {
  return cart.filter((l) => l.variantId !== variantId);
}

/**
 * Répartit une remise globale sur les lignes, au prorata de leur montant.
 *
 * La somme des parts retombe EXACTEMENT sur la remise demandée : les centimes
 * perdus à l'arrondi sont redonnés aux lignes dont la fraction était la plus
 * grande (méthode du plus fort reste). Sans ça, un « −10 € » sur trois lignes
 * pouvait n'en retirer que 9,99 et faire dériver la caisse.
 */
export function allocateDiscount(amounts: number[], discount: number): number[] {
  const total = amounts.reduce((a, b) => a + b, 0);
  if (discount <= 0 || total <= 0) return amounts.map(() => 0);

  const capped = Math.min(discount, total);
  const raw = amounts.map((a) => (a * capped) / total);
  const out = raw.map(Math.floor);
  let rest = capped - out.reduce((a, b) => a + b, 0);

  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (rest <= 0) break;
    out[i]++;
    rest--;
  }
  return out;
}
