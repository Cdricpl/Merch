import { createContext, useContext, useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import type { Family, Variant, Concert, Sale } from "./types";

type Store = {
  families: Family[];
  variants: Variant[];
  concerts: Concert[];
  sales: Sale[];
  loading: boolean;
};

const Ctx = createContext<Store | null>(null);

// PERF : un cache par collection, et non un seul gros blob.
// `families` porte les images en base64 (~50-80 kB pièce) : les sérialiser à
// chaque vente bloquait le thread principal plusieurs dizaines de ms. Avec des
// clés séparées, une vente ne réécrit que `variants` et `sales` (quelques kB),
// et jamais les images.
const LS_PREFIX = "merch:v4:";

function readCache<T>(name: string): T[] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + name);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

// Écriture différée : une rafale de snapshots Firestore (écriture locale
// optimiste puis confirmation serveur) se réduit à une seule sérialisation.
function useDeferredCache<T>(name: string, rows: T[]) {
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LS_PREFIX + name, JSON.stringify(rows));
      } catch {
        /* quota dépassé — le cache n'est qu'un confort hors-ligne */
      }
    }, 800);
    return () => clearTimeout(id);
  }, [name, rows]);
}

// Firestore returns document snapshots — convert to our typed shape (id + data).
function toRows<T>(snap: { docs: { id: string; data(): unknown }[] }): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [families, setFamilies] = useState<Family[]>(() => readCache<Family>("families"));
  const [variants, setVariants] = useState<Variant[]>(() => readCache<Variant>("variants"));
  const [concerts, setConcerts] = useState<Concert[]>(() => readCache<Concert>("concerts"));
  const [sales, setSales] = useState<Sale[]>(() => readCache<Sale>("sales"));
  const [loadCount, setLoadCount] = useState(0); // increments as each snapshot lands

  useDeferredCache("families", families);
  useDeferredCache("variants", variants);
  useDeferredCache("concerts", concerts);
  useDeferredCache("sales", sales);

  useEffect(() => {
    const bumpOnce = () => setLoadCount((n) => Math.min(n + 1, 4));

    const u1 = onSnapshot(query(collection(db, "families"), orderBy("sort_order")), (snap) => {
      setFamilies(toRows<Family>(snap));
      bumpOnce();
    });
    const u2 = onSnapshot(query(collection(db, "variants"), orderBy("sort_order")), (snap) => {
      setVariants(toRows<Variant>(snap));
      bumpOnce();
    });
    const u3 = onSnapshot(query(collection(db, "concerts"), orderBy("concert_date", "desc")), (snap) => {
      setConcerts(toRows<Concert>(snap));
      bumpOnce();
    });
    const u4 = onSnapshot(query(collection(db, "sales"), orderBy("created_at", "desc")), (snap) => {
      setSales(toRows<Sale>(snap));
      bumpOnce();
    });

    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const loading = loadCount < 4 && families.length === 0;

  return (
    <Ctx.Provider value={{ families, variants, concerts, sales, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
