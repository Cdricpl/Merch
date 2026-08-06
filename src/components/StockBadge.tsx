import { levelBg, levelFor } from "../lib/stockLevel";

export function StockBadge({ stock, alert, size = "md" }: { stock: number; alert: number; size?: "sm" | "md" }) {
  const l = levelFor(stock, alert);
  const dim = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center font-bold shrink-0 shadow-lg ${levelBg(l)}`}
    >
      {stock}
    </div>
  );
}
