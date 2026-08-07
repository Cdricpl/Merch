import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  runTransaction,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Family, Variant } from "./types";

// -------- Concerts --------

export async function createConcert(name: string, dateISO: string): Promise<string> {
  const ref = await addDoc(collection(db, "concerts"), {
    name,
    concert_date: dateISO,
    is_active: true,
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
    low_alert: 3,
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

// -------- Reset : delete everything (danger) --------

export async function resetAllData() {
  const cols = ["sales", "variants", "families", "concerts"];
  for (const c of cols) {
    const snap = await getDocs(collection(db, c));
    // chunk deletes at 400 per batch (Firestore batch limit is 500)
    let batch = writeBatch(db);
    let n = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      n++;
      if (n === 400) {
        await batch.commit();
        batch = writeBatch(db);
        n = 0;
      }
    }
    if (n > 0) await batch.commit();
  }
}

// -------- Initial seed (only usable when store is empty) --------
//
// T-shirts sont désormais UNIFIÉS : une seule famille par modèle, avec
// des variantes (subcategory: "Homme"|"Femme", label: "S"|"M"|...).
// Les CDs restent des familles à variante unique (label=null, sans subcategory).

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

  // CDs — pas de subcategory, pas de label
  const noNut = mkFam("CD — No Nut's no Glory", 1000, 10);
  const ep    = mkFam("CD — The EP with no names", 1000, 20);
  const anniv = mkFam("CD — 20th Anniversaire", 1000, 30);

  mkVar(noNut, null, null, 45, 10);
  mkVar(ep,    null, null, 71, 10);
  mkVar(anniv, null, null, 22, 10);

  // T-shirt Negan (que Homme 2XL pour l'instant)
  const negan = mkFam("T-shirt Negan", 2000, 100);
  mkVar(negan, "Homme", "2XL", 3, 160);

  // T-shirt Ardenne Heavy — Homme + Femme unifiés
  const ah = mkFam("T-shirt Ardenne Heavy", 2000, 110);
  // Homme
  mkVar(ah, "Homme", "S",  9, 110);
  mkVar(ah, "Homme", "M",  4, 120);
  mkVar(ah, "Homme", "L",  8, 130);
  mkVar(ah, "Homme", "XL", 1, 140);
  // Femme
  mkVar(ah, "Femme", "S",  8, 210);
  mkVar(ah, "Femme", "M",  4, 220);
  mkVar(ah, "Femme", "L",  4, 230);
  mkVar(ah, "Femme", "XL", 1, 240);

  // T-shirt Boris — Homme + Femme unifiés
  const boris = mkFam("T-shirt Boris", 2000, 120);
  // Homme
  mkVar(boris, "Homme", "S",   12, 110);
  mkVar(boris, "Homme", "M",    9, 120);
  mkVar(boris, "Homme", "L",   10, 130);
  mkVar(boris, "Homme", "XL",   6, 140);
  mkVar(boris, "Homme", "2XL",  3, 150);
  // Femme
  mkVar(boris, "Femme", "S",   7, 210);
  mkVar(boris, "Femme", "M",   4, 220);
  mkVar(boris, "Femme", "L",   2, 230);

  await batch.commit();
}
