import { familyLevel, levelBg } from "../lib/stockLevel";

export function StockBadge({
  stock,
  alert,
  lowCount = 0,
}: {
  stock: number;
  alert: number;
  /** Nombre de variantes sous le seuil — colore en rouge même si le total est élevé. */
  lowCount?: number;
}) {
  const shown = Math.max(0, stock);
  return (
    <div
      className={`w-8 h-8 text-xs rounded-full flex items-center justify-center font-bold shrink-0 shadow-lg ${levelBg(
        familyLevel(shown, lowCount, alert)
      )}`}
    >
      {shown}
    </div>
  );
}
