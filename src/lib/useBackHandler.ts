import { useEffect, useLayoutEffect, useRef } from "react";

// Handler stack for the phone's hardware back button (or browser back).
// Pattern: each mounted layer (modal, detail view, sub-step) pushes an entry
// AND a fresh history state. On popstate we pop the top handler and call it.
// On UI-triggered unmount (user tapped X, tab switch, etc.), we splice our
// entry and rewind history one step so the stack stays consistent with real
// browser history.

type Entry = { cb: () => void };

const stack: Entry[] = [];
let listenerAttached = false;
let programmaticBackPending = 0;

function ensureListener() {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener("popstate", () => {
    // Ignore popstates we triggered ourselves during cleanup.
    if (programmaticBackPending > 0) {
      programmaticBackPending--;
      return;
    }
    const top = stack.pop();
    if (top) top.cb();
  });
}

export function useBackHandler(active: boolean, onBack: () => void) {
  // Mise à jour dans un effet de layout plutôt que pendant le rendu : un rendu
  // concurrent peut être abandonné, et y écrire la ref laisserait une version
  // jamais validée. L'effet passe avant la peinture, donc bien avant qu'un
  // appui sur « retour » puisse survenir.
  const cbRef = useRef(onBack);
  useLayoutEffect(() => {
    cbRef.current = onBack;
  });

  useEffect(() => {
    if (!active) return;
    ensureListener();

    const entry: Entry = { cb: () => cbRef.current() };
    stack.push(entry);
    window.history.pushState({ __back: stack.length }, "");

    return () => {
      const idx = stack.indexOf(entry);
      if (idx === -1) {
        // Already consumed by a real back gesture — history is already rewound.
        return;
      }
      stack.splice(idx, 1);
      programmaticBackPending++;
      window.history.back();
    };
  }, [active]);
}
