import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Renvoie une fonction dont l'identité ne change JAMAIS, tout en appelant
 * toujours la dernière version du corps fourni.
 *
 * Sans ça, un handler qui dépend des ventes du concert change d'identité à
 * chaque vente, ce qui invalide le React.memo des cartes produit : les six
 * cartes se re-rendaient alors qu'une seule avait bougé.
 *
 * La référence est mise à jour dans un effet de layout, jamais pendant le
 * rendu : un rendu concurrent peut être abandonné, et écrire la ref à ce
 * moment-là y laisserait une version qui n'a jamais été validée. L'effet
 * s'exécute avant la peinture, donc la fonction est à jour bien avant qu'un
 * doigt puisse déclencher l'événement.
 */
export function useStableCallback<A extends unknown[], R>(fn: (...args: A) => R) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: A) => ref.current(...args), []);
}
