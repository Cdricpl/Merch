import { ChevronRight } from "lucide-react";
import { levelBar, levelFor, levelText } from "../lib/stockLevel";
import type { Variant } from "../lib/types";

/** Ligne « une taille » : libellé, jauge, quantité colorée. */
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
      className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-muted/40 transition"
    >
      <span className="w-8 shrink-0 font-semibold text-[14px]">{variant.label ?? "—"}</span>
      <span className="gauge flex-1">
        <span className={levelBar(l)} style={{ width: `${pct}%` }} />
      </span>
      <span className={`w-7 text-right font-display text-[17px] ${levelText(l)}`}>{variant.stock}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
