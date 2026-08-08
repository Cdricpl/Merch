import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useStore } from "./store";
import type { Concert } from "./types";

// Le concert choisi survit aux changements d'onglet et aux rechargements.
const LS_KEY = "merch:activeConcert";

type Ctx = {
  concert: Concert | null;
  pick: (id: string) => void;
};

const C = createContext<Ctx | null>(null);

/**
 * Le concert en cours est remonté ici parce qu'il survit au changement
 * d'onglet et au rechargement, alors que le choix se fait depuis Ventes.
 */
export function ActiveConcertProvider({ children }: { children: React.ReactNode }) {
  const { concerts } = useStore();
  const [id, setId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  });

  const pick = useCallback((next: string) => {
    setId(next);
    try { localStorage.setItem(LS_KEY, next); } catch { /* mode privé */ }
  }, []);

  const concert = useMemo(() => {
    if (concerts.length === 0) return null;
    if (id) {
      const found = concerts.find((c) => c.id === id);
      if (found) return found;
    }
    // À défaut : le premier concert ouvert, en privilégiant celui marqué actif.
    const open = concerts.filter((c) => !c.is_closed);
    return open.find((c) => c.is_active) ?? open[0] ?? null;
  }, [concerts, id]);

  const value = useMemo(() => ({ concert, pick }), [concert, pick]);

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useActiveConcert() {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useActiveConcert must be used inside ActiveConcertProvider");
  return ctx;
}
