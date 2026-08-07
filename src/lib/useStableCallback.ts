import { useCallback, useRef } from "react";

/**
 * Renvoie une fonction dont l'identité ne change JAMAIS, tout en appelant
 * toujours la dernière version du corps fourni.
 *
 * Sans ça, un handler qui dépend des ventes du concert change d'identité à
 * chaque vente, ce qui invalide le React.memo des cartes produit : les six
 * cartes se re-rendaient alors qu'une seule avait bougé.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}
