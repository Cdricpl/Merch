import { familyLevel, levelBg } from "../lib/stockLevel";

export function StockBadge({
  stock,
  lowCount = 0,
}: {
  stock: number;
  /** Nombre de tailles dans le rouge — colore la pastille même si le total est élevé. */
  lowCount?: number;
}) {
  const shown = Math.max(0, stock);
  return (
    <div
      className={`w-8 h-8 text-xs rounded-full flex items-center justify-center font-bold shrink-0 shadow-lg ${levelBg(
        familyLevel(shown, lowCount)
      )}`}
    >
      {shown}
    </div>
  );
}
