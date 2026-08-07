import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, type Query } from "firebase/firestore";
import { db, kickConnection } from "./firebase";
import type { Family, Variant, Concert, Sale, Expense, Settlement } from "./types";

type Store = {
  families: Family[];
  variants: Variant[];
  concerts: Concert[];
  sales: Sale[];
  expenses: Expense[];
  settlements: Settlement[];
  loading: boolean;
  /** Les écoutes temps réel sont tombées ; une reconnexion est en cours. */
  degraded: boolean;
};

const Ctx = createContext<Store | null>(null);

// PERF : un cache par collection, et non un seul gros blob.
// `families` porte les images en base64 (~50-80 kB pièce) : les sérialiser à
// chaque vente bloquait le thread principal plusieurs dizaines de ms. Avec des
// clés séparées, une vente ne réécrit que `variants` et `sales` (quelques kB),
// et jamais les images.
const LS_PREFIX = "merch:v4:";

// Au-delà de cette durée en arrière-plan, on considère la connexion temps réel
// comme perdue et on la reconstruit au retour au premier plan.
const STALE_AFTER_MS = 60_000;

// Nombre d'écoutes temps réel : sert de repère pour savoir quand tout est arrivé.
const SUBSCRIPTIONS = 6;

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
  const [expenses, setExpenses] = useState<Expense[]>(() => readCache<Expense>("expenses"));
  const [settlements, setSettlements] = useState<Settlement[]>(() => readCache<Settlement>("settlements"));
  const [loadCount, setLoadCount] = useState(0); // increments as each snapshot lands
  const [degraded, setDegraded] = useState(false);

  // Incrémenter cette valeur relance entièrement les écoutes.
  const [epoch, setEpoch] = useState(0);
  const attemptRef = useRef(0);

  useDeferredCache("families", families);
  useDeferredCache("variants", variants);
  useDeferredCache("concerts", concerts);
  useDeferredCache("sales", sales);
  useDeferredCache("expenses", expenses);
  useDeferredCache("settlements", settlements);

  /** Reconstruit la connexion puis se réabonne. */
  const resync = useCallback(() => {
    kickConnection().finally(() => setEpoch((n) => n + 1));
  }, []);

  useEffect(() => {
    // Une erreur d'écoute suffit à relancer tout le bloc : inutile de le faire
    // quatre fois si les quatre collections tombent ensemble.
    let restarting = false;
    let retryId: ReturnType<typeof setTimeout> | undefined;
    const unsubs: Array<() => void> = [];

    const onData = () => {
      attemptRef.current = 0;
      setDegraded(false);
      setLoadCount((n) => Math.min(n + 1, SUBSCRIPTIONS));
    };

    // onSnapshot SANS callback d'erreur détache l'écoute DÉFINITIVEMENT et en
    // silence : l'app continue d'afficher les derniers chiffres reçus, sans
    // jamais rien recevoir de neuf. C'était ça, le « bug » qui n'était réparable
    // qu'en fermant et rouvrant l'app — le remontage recréait les écoutes.
    const onError = () => {
      if (restarting) return;
      restarting = true;
      setDegraded(true);
      // Palier exponentiel plafonné : en salle, le réseau peut être absent
      // plusieurs minutes d'affilée.
      const wait = Math.min(30_000, 1_000 * 2 ** attemptRef.current++);
      retryId = setTimeout(() => {
        kickConnection().finally(() => setEpoch((n) => n + 1));
      }, wait);
    };

    const sub = <T,>(q: Query, set: (rows: T[]) => void) =>
      unsubs.push(
        onSnapshot(
          q,
          (snap) => { set(toRows<T>(snap)); onData(); },
          onError
        )
      );

    sub<Family>(query(collection(db, "families"), orderBy("sort_order")), setFamilies);
    sub<Variant>(query(collection(db, "variants"), orderBy("sort_order")), setVariants);
    sub<Concert>(query(collection(db, "concerts"), orderBy("concert_date", "desc")), setConcerts);
    sub<Sale>(query(collection(db, "sales"), orderBy("created_at", "desc")), setSales);
    sub<Expense>(query(collection(db, "expenses"), orderBy("created_at", "desc")), setExpenses);
    sub<Settlement>(query(collection(db, "settlements"), orderBy("created_at", "desc")), setSettlements);

    return () => {
      restarting = true;
      if (retryId) clearTimeout(retryId);
      for (const u of unsubs) u();
    };
  }, [epoch]);

  // Réveil après une mise en veille : le flux temps réel est probablement mort,
  // même si aucune erreur n'a été remontée. On le reconstruit avant que
  // quiconque ne consulte des chiffres périmés.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt > 0 && Date.now() - hiddenAt > STALE_AFTER_MS) resync();
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    // Le retour du réseau mérite le même traitement : le SDK ne rouvre pas
    // toujours son flux de lui-même.
    window.addEventListener("online", resync);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", resync);
    };
  }, [resync]);

  const loading = loadCount < SUBSCRIPTIONS && families.length === 0;

  return (
    <Ctx.Provider value={{ families, variants, concerts, sales, expenses, settlements, loading, degraded }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
