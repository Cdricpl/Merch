import { memo } from "react";
import { Plus, Minus, ChevronRight } from "lucide-react";
import { formatEUR } from "../lib/format";
import { parseName } from "../lib/category";
import { familyLevel, levelBg } from "../lib/stockLevel";
import type { Family, Variant } from "../lib/types";

// memo : sans ça, vendre un CD re-rendait les 6 cartes (dont les <img> base64,
// coûteuses à repeindre sur mobile).
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
    <div className="card-surface relative rounded-2xl p-2.5 flex flex-col">
      {/* Pastille de stock, posée dans le coin de la vignette. */}
      <span
        className={`absolute top-2.5 right-2.5 z-10 min-w-7 h-7 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${levelBg(
          familyLevel(shown, lowCount, family.low_alert)
        )}`}
      >
        {shown}
      </span>

      {inCart > 0 && (
        <span className="absolute top-2.5 left-2.5 z-10 min-w-6 h-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center ring-2 ring-card">
          {inCart}
        </span>
      )}

      <button
        onClick={handlePrimary}
        disabled={disabled}
        className="w-full aspect-[5/4] flex items-center justify-center disabled:opacity-40 active:opacity-70 transition"
      >
        {family.image ? (
          <img
            src={family.image}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-w-[76%] max-h-full object-contain rounded-lg drop-shadow-[0_8px_14px_rgba(0,0,0,0.75)]"
          />
        ) : (
          <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
            {category || "produit"}
          </span>
        )}
      </button>

      <div className="mt-1 min-w-0">
        {category && (
          <div className="text-[9px] font-medium tracking-[0.14em] uppercase text-muted-foreground">
            {category}
          </div>
        )}
        <div className="font-semibold text-[13.5px] leading-tight text-foreground truncate mt-0.5">
          {display}
        </div>
        <div className="text-primary font-bold text-[15px] mt-1">{formatEUR(family.price_cents)}</div>
      </div>

      {/* Compteur : − / vendus / + */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => onRemove(family)}
          disabled={!canRemove}
          aria-label={inCart > 0 ? "Retirer du panier" : "Annuler la dernière vente"}
          className="btn-step w-9 h-8 shrink-0"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center leading-none min-w-0">
          <span className="font-display text-[19px]">{sold}</span>
          <span className="text-[9px] text-muted-foreground mt-0.5">vendus</span>
        </div>

        <button
          onClick={handlePrimary}
          disabled={disabled}
          aria-label={single ? "Vendre 1" : "Choisir taille"}
          className="btn-step w-9 h-8 shrink-0 !text-foreground"
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
