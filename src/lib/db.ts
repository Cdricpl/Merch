import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Payment } from "./payment";
import type { Family, Variant } from "./types";

// -------- Concerts --------

export async function createConcert(name: string, dateISO: string): Promise<string> {
  const ref = await addDoc(collection(db, "concerts"), {
    name,
    concert_date: dateISO,
    is_active: true,
    is_closed: false,
    notes: null,
    created_at: Date.now(),
  });
  return ref.id;
}

export async function updateConcert(
  id: string,
  patch: { name?: string; concert_date?: string; is_active?: boolean; is_closed?: boolean; notes?: string | null }
) {
  await updateDoc(doc(db, "concerts", id), patch);
}

export async function deleteConcert(id: string, saleIds: string[]) {
  const batch = writeBatch(db);
  for (const sid of saleIds) batch.delete(doc(db, "sales", sid));
  batch.delete(doc(db, "concerts", id));
  await batch.commit();
}

// -------- Families & variants --------

export async function createFamily(name: string, priceCents: number): Promise<string> {
  const ref = await addDoc(collection(db, "families"), {
    name,
    price_cents: priceCents,
    sort_order: 200,
    created_at: Date.now(),
  });
  await addDoc(collection(db, "variants"), {
    family_id: ref.id,
    subcategory: null,
    label: null,
    stock: 0,
    sort_order: 10,
    created_at: Date.now(),
  });
  return ref.id;
}

export async function updateFamily(id: string, patch: Partial<Omit<Family, "id">>) {
  await updateDoc(doc(db, "families", id), patch as { [k: string]: unknown });
}

export async function deleteFamily(id: string, variantIds: string[], saleIds: string[]) {
  const batch = writeBatch(db);
  for (const sid of saleIds) batch.delete(doc(db, "sales", sid));
  for (const vid of variantIds) batch.delete(doc(db, "variants", vid));
  batch.delete(doc(db, "families", id));
  await batch.commit();
}

export async function createVariant(
  familyId: string,
  label: string | null,
  stock: number,
  subcategory: string | null = null,
) {
  await addDoc(collection(db, "variants"), {
    family_id: familyId,
    subcategory,
    label,
    stock: Math.max(0, stock),
    sort_order: 100,
    created_at: Date.now(),
  });
}

export async function updateVariant(id: string, patch: Partial<Omit<Variant, "id">>) {
  await updateDoc(doc(db, "variants", id), patch as { [k: string]: unknown });
}

export async function deleteVariant(id: string) {
  await deleteDoc(doc(db, "variants", id));
}

export async function replenishVariant(id: string, add: number) {
  await updateDoc(doc(db, "variants", id), { stock: increment(Math.max(0, add)) });
}

// -------- Sales --------
//
// PERF / OFFLINE : on utilise volontairement des écritures classiques avec
// increment() plutôt qu'une runTransaction(). Une transaction Firestore exige
// un aller-retour serveur AVANT d'être appliquée — le compteur ne bougeait donc
// qu'après la réponse réseau (plusieurs centaines de ms en 4G de salle, et rien
// du tout hors ligne). Un writeBatch + increment() est appliqué immédiatement au
// cache local : onSnapshot se déclenche dans la foulée, l'UI répond au doigt, et
// l'écriture est rejouée automatiquement quand le réseau revient.
//
// Contrepartie assumée : deux téléphones qui vendent la dernière pièce exactement
// en même temps peuvent faire passer le stock à -1. L'appelant vérifie le stock
// local avant d'appeler, et l'affichage borne à 0.

/**
 * Enregistre un passage en caisse complet : une ligne de vente par article du
 * panier, plus la sortie de stock correspondante, le tout dans un seul batch.
 *
 * La remise éventuelle est déjà répartie ligne par ligne par l'appelant
 * (cf. allocateDiscount) : chaque vente porte sa propre part, si bien que tous
 * les totaux — et l'annulation d'une ligne — restent justes sans avoir à
 * retrouver le panier d'origine.
 */
export async function recordCart(params: {
  concertId: string;
  lines: Array<{
    variantId: string;
    quantity: number;
    unitPriceCents: number;
    discountCents: number;
  }>;
  payment: Payment;
}) {
  const batch = writeBatch(db);
  // Un id de document sert d'identifiant de transaction : il est unique et
  // généré côté client, donc disponible immédiatement, même hors ligne.
  const group = doc(collection(db, "sales")).id;
  const now = Date.now();

  for (const l of params.lines) {
    batch.update(doc(db, "variants", l.variantId), { stock: increment(-l.quantity) });
    batch.set(doc(collection(db, "sales")), {
      concert_id: params.concertId,
      variant_id: l.variantId,
      quantity: l.quantity,
      unit_price_cents: l.unitPriceCents,
      discount_cents: l.discountCents,
      sale_group: group,
      created_at: now,
      payment_method: params.payment.method,
      payment_payee: params.payment.payee,
    });
  }
  await batch.commit();
}

export async function undoSale(saleId: string, variantId: string, quantity = 1) {
  const batch = writeBatch(db);
  batch.update(doc(db, "variants", variantId), { stock: increment(quantity) });
  batch.delete(doc(db, "sales", saleId));
  await batch.commit();
}

// -------- Initial seed (only usable when store is empty) --------
//
// T-shirts sont UNIFIÉS : une seule famille par modèle, avec des variantes
// (subcategory: "Homme"|"Femme", label: "S"|"M"|...).
// Les CDs restent des familles à variante unique (label=null, sans subcategory).

export async function seedInitialStock() {
  const now = Date.now();
  const batch = writeBatch(db);

  const mkFam = (name: string, price: number, sort: number) => {
    const ref = doc(collection(db, "families"));
    batch.set(ref, {
      name,
      price_cents: price,
      sort_order: sort,
      created_at: now,
    });
    return ref.id;
  };

  const mkVar = (
    fid: string,
    subcategory: string | null,
    label: string | null,
    stock: number,
    sort: number,
  ) => {
    batch.set(doc(collection(db, "variants")), {
      family_id: fid,
      subcategory,
      label,
      stock,
      sort_order: sort,
      created_at: now,
    });
  };

  // Femme = S, M, L, XL. Homme = S, M, L, XL, 2XL.
  // Toutes les tailles sont créées, même à 0.
  const HOMME_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
  const FEMME_SIZES = ["S", "M", "L", "XL"] as const;
  const mkHomme = (fid: string, stocks: Partial<Record<(typeof HOMME_SIZES)[number], number>>) => {
    HOMME_SIZES.forEach((s, i) => mkVar(fid, "Homme", s, stocks[s] ?? 0, 100 + i * 10));
  };
  const mkFemme = (fid: string, stocks: Partial<Record<(typeof FEMME_SIZES)[number], number>>) => {
    FEMME_SIZES.forEach((s, i) => mkVar(fid, "Femme", s, stocks[s] ?? 0, 200 + i * 10));
  };

  // CDs — pas de subcategory, pas de label
  const noNut = mkFam("CD — No Nut's no Glory", 1000, 10);
  const ep    = mkFam("CD — The EP with no names", 1000, 20);
  const anniv = mkFam("CD — 20th Anniversaire", 1000, 30);

  mkVar(noNut, null, null, 45, 10);
  mkVar(ep,    null, null, 71, 10);
  mkVar(anniv, null, null, 22, 10);

  // T-shirt Negan — Homme uniquement, seul 2XL en stock
  const negan = mkFam("T-shirt Negan", 2000, 100);
  mkHomme(negan, { "2XL": 3 });

  // T-shirt Ardenne Heavy
  const ah = mkFam("T-shirt Ardenne Heavy", 2000, 110);
  mkHomme(ah, { S: 9, M: 4, L: 8, XL: 1 });
  mkFemme(ah, { S: 8, M: 4, L: 4, XL: 1 });

  // T-shirt Boris
  const boris = mkFam("T-shirt Boris", 2000, 120);
  mkHomme(boris, { S: 12, M: 9, L: 10, XL: 6, "2XL": 3 });
  mkFemme(boris, { S: 7, M: 4, L: 2 });

  await batch.commit();
}
