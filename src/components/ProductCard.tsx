import { memo } from "react";
import { Plus, Minus, ChevronRight } from "lucide-react";
import { formatEUR } from "../lib/format";
import { parseName } from "../lib/category";
import { StockBadge } from "./StockBadge";
import type { Family, Variant } from "../lib/types";

// memo : sans ça, vendre un CD re-rendait les 6 cartes (dont les <img> base64
// avec filtre drop-shadow, coûteux à repeindre sur mobile).
//
// La comparaison par défaut ne suffirait pas : `variants` est un tableau
// reconstruit à chaque snapshot Firestore, donc jamais identique. On compare
// donc explicitement ce dont le rendu dépend réellement — d'où le comparateur
// plus bas. Résultat : seule la carte dont les chiffres bougent se re-rend.
export const ProductCard = memo(function ProductCard({
  family,
  variants,
  stock,
  sold,
  inCart,
  lowCount,
  onAdd,
  onRemove,
  onOpenPicker,
}: {
  family: Family;
  variants: Variant[];
  /** Stock disponible, ce qui est déjà au panier déduit. */
  stock: number;
  sold: number;
  /** Quantité de cette famille dans le panier en cours. */
  inCart: number;
  lowCount: number;
  onAdd: (family: Family, variant: Variant | undefined) => void;
  onRemove: (family: Family) => void;
  onOpenPicker: (family: Family) => void;
}) {
  const { category, display } = parseName(family.name);
  const single = variants.length === 1 && !variants[0].label;
  const shown = Math.max(0, stock);
  const disabled = shown <= 0;
  // Le « − » retire d'abord du panier ; sans panier en cours, il annule la
  // dernière vente déjà encaissée.
  const canRemove = inCart > 0 || sold > 0;

  const handlePrimary = () => (single ? onAdd(family, variants[0]) : onOpenPicker(family));

  return (
    <div className="metal-card relative rounded-2xl overflow-hidden flex flex-col">
      {/* Image area — image treated as an icon : centered, ombre portée,
          fond légèrement plus foncé pour trancher visuellement */}
      <button
        onClick={handlePrimary}
        disabled={disabled}
        className="relative w-full aspect-square flex items-center justify-center overflow-hidden disabled:opacity-40 active:opacity-70 transition
                   bg-[radial-gradient(circle_at_50%_35%,oklch(0.28_0.012_30),transparent_62%),linear-gradient(145deg,oklch(0.18_0.008_30),oklch(0.10_0.003_30))]"
      >
        {family.image ? (
          <img
            src={family.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-[78%] h-[78%] object-contain rounded-xl drop-shadow-[0_12px_15px_rgba(0,0,0,0.72)]"
          />
        ) : (
          <div className="text-muted-foreground text-[10px] tracking-wider uppercase">
            {category || "produit"}
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StockBadge stock={shown} alert={family.low_alert} lowCount={lowCount} />
        </div>
        {inCart > 0 && (
          <div className="absolute top-2 left-2 min-w-[1.4rem] h-[1.4rem] px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-lg shadow-black/40">
            {inCart}
          </div>
        )}
      </button>

      {/* Text */}
      <div className="px-3 pt-2 pb-1">
        {category && (
          <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
            {category}
          </div>
        )}
        <div className="font-semibold text-sm text-foreground truncate">{display}</div>
        <div className="text-primary font-display text-xl leading-none mt-1">{formatEUR(family.price_cents)}</div>
      </div>

      {/* Counter row */}
      <div className="flex items-stretch border-t border-border/60">
        <button
          onClick={() => onRemove(family)}
          disabled={!canRemove}
          aria-label={inCart > 0 ? "Retirer du panier" : "Annuler la dernière vente"}
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
          onClick={handlePrimary}
          disabled={disabled}
          aria-label={single ? "Vendre 1" : "Choisir taille"}
          className="flex-1 py-2.5 flex items-center justify-center text-primary active:bg-primary/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          {single ? <Plus className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}, (a, b) =>
  // `family` garde son identité tant que le document Firestore ne change pas :
  // une vente ne touche que `variants` et `sales`, jamais `families`.
  a.family === b.family &&
  a.stock === b.stock &&
  a.sold === b.sold &&
  a.inCart === b.inCart &&
  a.lowCount === b.lowCount &&
  // Seuls la longueur et le premier élément de `variants` influencent le rendu
  // (choix vente directe vs picker, et la variante vendue en un tap).
  a.variants.length === b.variants.length &&
  a.variants[0]?.id === b.variants[0]?.id &&
  a.variants[0]?.label === b.variants[0]?.label &&
  a.onAdd === b.onAdd &&
  a.onRemove === b.onRemove &&
  a.onOpenPicker === b.onOpenPicker
);
