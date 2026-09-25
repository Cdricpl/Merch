import { Disc3, Shirt, Package } from "lucide-react";

/**
 * Le dessin qui remplace la vignette quand le produit n'a pas de photo.
 *
 * Une zone vide avec un mot gris au milieu donnait l'impression d'une carte qui
 * n'a pas fini de charger. Un pictogramme dit la même chose et tient debout
 * tout seul. Le même sur la grille des ventes et sur la liste du stock, pour
 * qu'un produit se reconnaisse d'un écran à l'autre.
 */
export function ProductArt({ category, className }: { category: string; className?: string }) {
  const c = category.toUpperCase();
  const Icon = c.startsWith("CD") ? Disc3 : c.includes("SHIRT") ? Shirt : Package;
  return <Icon className={className} strokeWidth={1.6} />;
}
