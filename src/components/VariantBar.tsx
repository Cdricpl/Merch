import { levelBar, levelFor, levelText } from "../lib/stockLevel";
import type { Variant } from "../lib/types";

export function VariantBar({
  variant,
  alert,
  maxStock,
  onClick,
}: {
  variant: Variant;
  alert: number;
  maxStock: number;
  onClick?: () => void;
}) {
  const l = levelFor(variant.stock, alert);
  const pct = maxStock <= 0 ? 0 : Math.min(100, Math.round((variant.stock / maxStock) * 100));

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-2 px-2 rounded-md active:bg-muted/40 transition"
    >
      <div className="w-10 font-display text-base text-foreground text-left">
        {variant.label ?? "—"}
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${levelBar(l)} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={`w-10 text-right font-display text-lg ${levelText(l)}`}>
        {variant.stock}
      </div>
    </button>
  );
}
