// Code couleur du stock, en valeurs ABSOLUES — les mêmes pour tous les
// produits, pour qu'un rouge veuille toujours dire la même chose d'un écran à
// l'autre :
//   0 à 3   → rouge
//   4 à 9   → orange
//   10 et + → vert

export type StockLevel = "critical" | "warning" | "ok";

export const RED_MAX = 3;
export const ORANGE_MAX = 9;

export function levelFor(stock: number): StockLevel {
  if (stock <= RED_MAX) return "critical";
  if (stock <= ORANGE_MAX) return "warning";
  return "ok";
}

/**
 * Niveau d'une famille entière.
 *
 * Le cumul d'une famille (ex. 40 t-shirts toutes tailles) ne descend jamais
 * dans le rouge, alors qu'une taille à 1 doit alerter : dès qu'une variante est
 * dans le rouge, la famille l'est aussi.
 */
export function familyLevel(totalStock: number, lowVariantCount: number): StockLevel {
  if (lowVariantCount > 0) return "critical";
  return levelFor(totalStock);
}

export function levelBg(l: StockLevel): string {
  switch (l) {
    case "critical": return "bg-destructive text-destructive-foreground";
    case "warning":  return "bg-warn text-black";
    case "ok":       return "bg-ok text-white";
  }
}

export function levelText(l: StockLevel): string {
  switch (l) {
    case "critical": return "text-destructive";
    case "warning":  return "text-warn";
    case "ok":       return "text-ok";
  }
}

export function levelBar(l: StockLevel): string {
  switch (l) {
    case "critical": return "bg-destructive";
    case "warning":  return "bg-warn";
    case "ok":       return "bg-ok";
  }
}
