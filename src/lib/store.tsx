import { createContext, useContext, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import type { Family, Variant, Concert, Sale } from "./types";

type Store = {
  families: Family[];
  variants: Variant[];
  concerts: Concert[];
  sales: Sale[];
  loading: boolean;
  seeded: boolean;
};

const Ctx = createContext<Store | null>(null);

const LS_KEY = "merch:cache:v3";

type Cache = {
  families: Family[];
  variants: Variant[];
  concerts: Concert[];
  sales: Sale[];
};

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { families: [], variants: [], concerts: [], sales: [] };
    return JSON.parse(raw) as Cache;
  } catch {
    return { families: [], variants: [], concerts: [], sales: [] };
  }
}

function writeCache(cache: Cache) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(cache)); } catch {}
}

// Firestore returns document snapshots — convert to our typed shape (id + data).
function toRows<T>(snap: { docs: { id: string; data(): unknown }[] }): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as T);
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const initial = readCache();
  const [families, setFamilies] = useState<Family[]>(initial.families);
  const [variants, setVariants] = useState<Variant[]>(initial.variants);
  const [concerts, setConcerts] = useState<Concert[]>(initial.concerts);
  const [sales, setSales] = useState<Sale[]>(initial.sales);
  const [loadCount, setLoadCount] = useState(0); // increments as each snapshot lands

  const cacheRef = useRef<Cache>(initial);
  useEffect(() => {
    cacheRef.current = { families, variants, concerts, sales };
    writeCache(cacheRef.current);
  }, [families, variants, concerts, sales]);

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
  const seeded = families.length > 0;

  return (
    <Ctx.Provider value={{ families, variants, concerts, sales, loading, seeded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
