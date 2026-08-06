import { Plus, Minus, ChevronRight } from "lucide-react";
import { formatEUR } from "../lib/format";
import { parseName } from "../lib/category";
import { StockBadge } from "./StockBadge";
import type { Family, Variant } from "../lib/types";

export function ProductCard({
  family,
  variants,
  stock,
  sold,
  onAdd,
  onRemove,
  onOpenPicker,
}: {
  family: Family;
  variants: Variant[];
  stock: number;
  sold: number;
  onAdd: () => void;
  onRemove: () => void;
  onOpenPicker: () => void;
}) {
  const { category, display } = parseName(family.name);
  const single = variants.length === 1 && !variants[0].label;
  const disabled = stock <= 0;
  const canRemove = sold > 0;

  return (
    <div className="relative bg-card border border-border/60 rounded-xl overflow-hidden flex flex-col">
      {/* Image area with stock badge */}
      <button
        onClick={single ? onAdd : onOpenPicker}
        disabled={disabled}
        className="relative w-full aspect-square bg-muted/40 flex items-center justify-center overflow-hidden disabled:opacity-40 active:opacity-70 transition"
      >
        {family.image ? (
          <img src={family.image} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
            {category || "produit"}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StockBadge stock={stock} alert={family.low_alert} />
        </div>
      </button>

      {/* Text */}
      <div className="px-3 pt-2 pb-1">
        {category && (
          <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
            {category}
          </div>
        )}
        <div className="font-semibold text-sm text-foreground truncate">{display}</div>
        <div className="text-primary font-display text-base mt-0.5">{formatEUR(family.price_cents)}</div>
      </div>

      {/* Counter row */}
      <div className="flex items-stretch border-t border-border/60">
        <button
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Annuler la dernière vente"
          className="flex-1 py-2.5 flex items-center justify-center text-muted-foreground active:bg-muted/50 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 py-2.5 flex flex-col items-center justify-center border-x border-border/60 min-w-0">
          <div className="font-display text-lg leading-none">{sold}</div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none mt-0.5">
            vendus
          </div>
        </div>
        <button
          onClick={single ? onAdd : onOpenPicker}
          disabled={disabled}
          aria-label={single ? "Vendre 1" : "Choisir taille"}
          className="flex-1 py-2.5 flex items-center justify-center text-primary active:bg-primary/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          {single ? <Plus className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
