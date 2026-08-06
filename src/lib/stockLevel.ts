// Colored dot / bar system used across the app.
// - 0            → empty (grey)
// - <= alert     → critical (red)
// - <= alert*4   → warning (orange)
// - > alert*4    → ok (green)

export type StockLevel = "empty" | "critical" | "warning" | "ok";

export function levelFor(stock: number, alert: number): StockLevel {
  if (stock <= 0) return "empty";
  if (stock <= alert) return "critical";
  if (stock <= alert * 4) return "warning";
  return "ok";
}

export function levelBg(l: StockLevel): string {
  switch (l) {
    case "empty":    return "bg-muted text-muted-foreground";
    case "critical": return "bg-destructive text-destructive-foreground";
    case "warning":  return "bg-amber-500 text-black";
    case "ok":       return "bg-emerald-600 text-white";
  }
}

export function levelText(l: StockLevel): string {
  switch (l) {
    case "empty":    return "text-muted-foreground";
    case "critical": return "text-destructive";
    case "warning":  return "text-amber-500";
    case "ok":       return "text-emerald-500";
  }
}

export function levelBar(l: StockLevel): string {
  switch (l) {
    case "empty":    return "bg-muted";
    case "critical": return "bg-destructive";
    case "warning":  return "bg-amber-500";
    case "ok":       return "bg-emerald-600";
  }
}
