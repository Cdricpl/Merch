import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Family, Variant } from "./types";

// -------- Concerts --------

export async function createConcert(name: string, dateISO: string): Promise<string> {
  // Deactivate existing active concerts (only one active at a time)
  const now = Date.now();
  const ref = await addDoc(collection(db, "concerts"), {
    name,
    concert_date: dateISO,
    is_active: true,
    notes: null,
    created_at: now,
  });
  return ref.id;
}

export async function updateConcert(
  id: string,
  patch: { name?: string; concert_date?: string; is_active?: boolean; notes?: string | null }
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
    low_alert: 3,
    sort_order: 200,
    created_at: Date.now(),
  });
  // Create a default variantless entry so the product is immediately sellable
  await addDoc(collection(db, "variants"), {
    family_id: ref.id,
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

export async function createVariant(familyId: string, label: string | null, stock: number) {
  await addDoc(collection(db, "variants"), {
    family_id: familyId,
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
  await runTransaction(db, async (t) => {
    const ref = doc(db, "variants", id);
    const s = await t.get(ref);
    const cur = (s.data()?.stock as number) ?? 0;
    t.update(ref, { stock: cur + Math.max(0, add) });
  });
}

// -------- Sales (transactional : decrement stock atomically) --------

export async function recordSale(params: {
  concertId: string;
  variantId: string;
  priceCents: number;
}) {
  await runTransaction(db, async (t) => {
    const vRef = doc(db, "variants", params.variantId);
    const v = await t.get(vRef);
    if (!v.exists()) throw new Error("variante introuvable");
    const stock = (v.data()?.stock as number) ?? 0;
    if (stock <= 0) throw new Error("Stock épuisé");
    t.update(vRef, { stock: stock - 1 });
    t.set(doc(collection(db, "sales")), {
      concert_id: params.concertId,
      variant_id: params.variantId,
      quantity: 1,
      unit_price_cents: params.priceCents,
      created_at: Date.now(),
    });
  });
}

export async function undoSale(saleId: string) {
  await runTransaction(db, async (t) => {
    const sRef = doc(db, "sales", saleId);
    const s = await t.get(sRef);
    if (!s.exists()) return;
    const data = s.data() as { variant_id: string; quantity: number };
    const vRef = doc(db, "variants", data.variant_id);
    const v = await t.get(vRef);
    const cur = (v.data()?.stock as number) ?? 0;
    t.update(vRef, { stock: cur + (data.quantity ?? 1) });
    t.delete(sRef);
  });
}

// -------- Initial seed (only usable when store is empty) --------

export async function seedInitialStock() {
  const now = Date.now();
  const batch = writeBatch(db);

  const mkFam = (name: string, price: number, sort: number) => {
    const ref = doc(collection(db, "families"));
    batch.set(ref, {
      name,
      price_cents: price,
      low_alert: 3,
      sort_order: sort,
      created_at: now,
    });
    return ref.id;
  };

  const mkVar = (fid: string, label: string | null, stock: number, sort: number) => {
    batch.set(doc(collection(db, "variants")), {
      family_id: fid,
      label,
      stock,
      sort_order: sort,
      created_at: now,
    });
  };

  const noNut = mkFam("CD — No Nut's no Glory", 1000, 10);
  const ep = mkFam("CD — The EP with no names", 1000, 20);
  const anniv = mkFam("CD — 20th Anniversaire", 1000, 30);

  mkVar(noNut, null, 45, 10);
  mkVar(ep, null, 71, 10);
  mkVar(anniv, null, 22, 10);

  const negan = mkFam("T-shirt Negan Homme", 2000, 100);
  mkVar(negan, "2XL", 3, 60);

  const ahF = mkFam("T-shirt Ardenne Heavy Femme", 2000, 110);
  mkVar(ahF, "S", 8, 10);
  mkVar(ahF, "M", 4, 20);
  mkVar(ahF, "L", 4, 30);
  mkVar(ahF, "XL", 1, 40);

  const ahH = mkFam("T-shirt Ardenne Heavy Homme", 2000, 120);
  mkVar(ahH, "S", 9, 10);
  mkVar(ahH, "M", 4, 20);
  mkVar(ahH, "L", 8, 30);
  mkVar(ahH, "XL", 1, 40);

  const bF = mkFam("T-shirt Boris Femme", 2000, 130);
  mkVar(bF, "S", 7, 10);
  mkVar(bF, "M", 4, 20);
  mkVar(bF, "L", 2, 30);

  const bH = mkFam("T-shirt Boris Homme", 2000, 140);
  mkVar(bH, "S", 12, 10);
  mkVar(bH, "M", 9, 20);
  mkVar(bH, "L", 10, 30);
  mkVar(bH, "XL", 6, 40);
  mkVar(bH, "2XL", 3, 50);

  await batch.commit();
}
