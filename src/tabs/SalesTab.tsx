import { useCallback, useMemo, useState } from "react";
import { useStableCallback } from "../lib/useStableCallback";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Plus, X, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { recordSale, undoSale, seedInitialStock } from "../lib/db";
import { useBackHandler } from "../lib/useBackHandler";
import type { Family, Variant, Concert } from "../lib/types";
import { NewConcertModal } from "../components/NewConcertModal";
import { CaisseCard } from "../components/CaisseCard";
import { ProductCard } from "../components/ProductCard";

// Le concert choisi survit aux changements d'onglet et aux rechargements.
const LS_CONCERT = "merch:activeConcert";

export function SalesTab() {
  const { families, variants, concerts, sales, loading } = useStore();
  const [pickerFamily, setPickerFamily] = useState<Family | null>(null);
  const [concertPicker, setConcertPicker] = useState(false);
  const [newConcertOpen, setNewConcertOpen] = useState(false);
  const [activeConcertId, setActiveConcertId] = useState<string | null>(() => {
    try { return localStorage.getItem(LS_CONCERT); } catch { return null; }
  });
  const [seeding, setSeeding] = useState(false);

  const pickConcert = useCallback((id: string) => {
    setActiveConcertId(id);
    try { localStorage.setItem(LS_CONCERT, id); } catch { /* mode privé */ }
  }, []);

  const concert: Concert | null = useMemo(() => {
    if (concerts.length === 0) return null;
    if (activeConcertId) {
      const found = concerts.find((c) => c.id === activeConcertId);
      if (found) return found;
    }
    const open = concerts.filter((c) => !c.is_closed);
    return open.find((c) => c.is_active) ?? open[0] ?? null;
  }, [concerts, activeConcertId]);

  const salesThisConcert = useMemo(
    () => (concert ? sales.filter((s) => s.concert_id === concert.id) : []),
    [sales, concert]
  );

  const totalCents = salesThisConcert.reduce((s, x) => s + x.quantity * x.unit_price_cents, 0);
  const totalItems = salesThisConcert.reduce((s, x) => s + x.quantity, 0);

  // PERF : un seul passage sur les ventes pour obtenir « vendus par variante ».
  // Avant, chaque variante refiltrait tout le tableau des ventes à chaque rendu
  // (O(variantes × ventes) et autant de tableaux intermédiaires alloués).
  const soldByVariant = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of salesThisConcert) {
      m.set(s.variant_id, (m.get(s.variant_id) ?? 0) + s.quantity);
    }
    return m;
  }, [salesThisConcert]);

  const variantsByFamily = useMemo(() => {
    const m = new Map<string, Variant[]>();
    for (const v of variants) {
      const arr = m.get(v.family_id);
      if (arr) arr.push(v);
      else m.set(v.family_id, [v]);
    }
    return m;
  }, [variants]);

  const grouped = useMemo(() => {
    return families.map((f) => {
      const items = variantsByFamily.get(f.id) ?? [];
      let stock = 0;
      let sold = 0;
      let lowCount = 0;
      for (const v of items) {
        stock += v.stock;
        sold += soldByVariant.get(v.id) ?? 0;
        if (v.stock <= f.low_alert) lowCount++;
      }
      return { family: f, items, stock, sold, lowCount };
    });
  }, [families, variantsByFamily, soldByVariant]);

  // Le total d'une famille (ex. 40 t-shirts toutes tailles confondues) ne passe
  // jamais sous le seuil d'alerte : on compte donc les TAILLES en alerte, ce qui
  // reflète réellement ce qu'il faut réassortir.
  const lowStockCount = useMemo(
    () => grouped.reduce((n, g) => n + g.lowCount, 0),
    [grouped]
  );

  // Identité stable : indispensable pour que le React.memo de ProductCard tienne
  // (cf. useStableCallback). Le corps voit malgré tout toujours l'état à jour.
  const doAddSale = useStableCallback(async (family: Family, variant: Variant | undefined) => {
    if (!concert || !variant) return;
    if (concert.is_closed) { toast.error("Concert clôturé"); return; }
    // Les écritures étant optimistes (cf. db.ts), c'est ici qu'on empêche de
    // vendre à découvert plutôt que dans une transaction serveur.
    if (variant.stock <= 0) { toast.error("Stock épuisé"); return; }
    navigator.vibrate?.(20);
    try {
      await recordSale({ concertId: concert.id, variantId: variant.id, priceCents: family.price_cents });
    } catch (e) { toast.error((e as Error).message); }
  });

  const doRemoveLastSale = useStableCallback(async (family: Family, variant?: Variant) => {
    if (!concert) return;
    // `sales` arrive déjà trié par created_at décroissant : le premier match est
    // donc la vente la plus récente, sans re-trier.
    let last;
    if (variant) {
      last = salesThisConcert.find((s) => s.variant_id === variant.id);
    } else {
      const ids = new Set((variantsByFamily.get(family.id) ?? []).map((v) => v.id));
      last = salesThisConcert.find((s) => ids.has(s.variant_id));
    }
    if (!last) return;
    navigator.vibrate?.(50);
    try { await undoSale(last.id, last.variant_id, last.quantity ?? 1); }
    catch (e) { toast.error((e as Error).message); }
  });

  const openPicker = useStableCallback((f: Family) => setPickerFamily(f));

  const doSeed = async () => {
    setSeeding(true);
    try {
      await seedInitialStock();
      toast.success("Stock initial chargé");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground">Chargement…</div>;
  }

  if (families.length === 0) {
    return (
      <div className="px-6 py-12 text-center space-y-4">
        <h2 className="font-display text-2xl">Aucun produit</h2>
        <p className="text-muted-foreground text-sm">
          Charge ton stock initial ou ajoute manuellement dans l'onglet Stock.
        </p>
        <button
          onClick={doSeed}
          disabled={seeding}
          className="rounded-md bg-primary text-primary-foreground font-display tracking-wider px-6 py-3 disabled:opacity-50"
        >
          {seeding ? "…" : "Charger le stock initial"}
        </button>
      </div>
    );
  }

  if (!concert) {
    const allClosed = concerts.length > 0;
    return (
      <div className="px-6 py-12 text-center space-y-4">
        <h2 className="font-display text-2xl">
          {allClosed ? "Aucun concert ouvert" : "Aucun concert"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {allClosed
            ? "Tous tes concerts sont clôturés. Crée-en un nouveau, ou rouvre un ancien depuis l'onglet Concerts."
            : "Crée une fiche concert pour commencer à compter les ventes."}
        </p>
        <button
          onClick={() => setNewConcertOpen(true)}
          className="rounded-md bg-primary text-primary-foreground font-display tracking-wider px-6 py-3"
        >
          Nouveau concert
        </button>
        {newConcertOpen && (
          <NewConcertModal onClose={() => setNewConcertOpen(false)} onCreated={pickConcert} />
        )}
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 space-y-4">
      <CaisseCard
        concert={concert}
        totalCents={totalCents}
        totalItems={totalItems}
        lowStockCount={lowStockCount}
        onTapConcert={() => setConcertPicker(true)}
      />

      <div className="px-1">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Produits</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {grouped.map(({ family, items, stock, sold, lowCount }) => (
          <ProductCard
            key={family.id}
            family={family}
            variants={items}
            stock={stock}
            sold={sold}
            lowCount={lowCount}
            onAdd={doAddSale}
            onRemove={doRemoveLastSale}
            onOpenPicker={openPicker}
          />
        ))}
      </div>

      {pickerFamily &&
        createPortal(
          <VariantPickerModal
            family={pickerFamily}
            variants={variantsByFamily.get(pickerFamily.id) ?? []}
            soldByVariant={soldByVariant}
            onAdd={(v) => doAddSale(pickerFamily, v)}
            onRemove={(v) => doRemoveLastSale(pickerFamily, v)}
            onClose={() => setPickerFamily(null)}
          />,
          document.body
        )}

      {concertPicker &&
        createPortal(
          <ConcertPickerModal
            concerts={concerts}
            currentId={concert.id}
            onPick={(id) => { pickConcert(id); setConcertPicker(false); }}
            onNew={() => { setConcertPicker(false); setNewConcertOpen(true); }}
            onClose={() => setConcertPicker(false)}
          />,
          document.body
        )}

      {newConcertOpen && (
        <NewConcertModal onClose={() => setNewConcertOpen(false)} onCreated={pickConcert} />
      )}
    </div>
  );
}

function VariantPickerModal({
  family, variants, soldByVariant, onAdd, onRemove, onClose,
}: {
  family: Family;
  variants: Variant[];
  soldByVariant: Map<string, number>;
  onAdd: (v: Variant) => void;
  onRemove: (v: Variant) => void;
  onClose: () => void;
}) {
  const countFor = (id: string) => soldByVariant.get(id) ?? 0;

  // Group variants by subcategory (preserving sort_order-based array order)
  const groups = useMemo(() => {
    const out: Array<{ subcategory: string | null; items: Variant[] }> = [];
    const seen = new Map<string, Variant[]>();
    for (const v of variants) {
      const key = v.subcategory ?? "";
      let bucket = seen.get(key);
      if (!bucket) {
        bucket = [];
        seen.set(key, bucket);
        out.push({ subcategory: v.subcategory ?? null, items: bucket });
      }
      bucket.push(v);
    }
    return out;
  }, [variants]);

  const subGroups = groups.filter((g) => g.subcategory !== null);
  const hasSub = subGroups.length > 0;

  // Étape 1 = choix Homme/Femme (uniquement si hasSub). Étape 2 = tailles.
  // Si un seul groupe (pas de sous-catégorie), on skip directement.
  const [pickedSub, setPickedSub] = useState<string | null>(hasSub ? null : (groups[0]?.subcategory ?? ""));

  // Back button du téléphone :
  // - Base : ferme le picker (fait toujours partie du picker mounted)
  // - Étape 2 (pickedSub set alors que hasSub) : revient à l'étape 1
  useBackHandler(true, onClose);
  useBackHandler(hasSub && pickedSub !== null, () => setPickedSub(null));

  const currentGroup = pickedSub === null
    ? null
    : (groups.find((g) => (g.subcategory ?? "") === pickedSub) ?? null);

  // Total vendus par sous-catégorie (affiché sur le bouton de step 1)
  const soldForGroup = (items: Variant[]) =>
    items.reduce((sum, v) => sum + countFor(v.id), 0);

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-4 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {hasSub && pickedSub !== null && (
              <button
                onClick={() => setPickedSub(null)}
                aria-label="Retour"
                className="p-2 -ml-2 text-muted-foreground shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
              {family.image && <img src={family.image} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg text-primary leading-tight truncate">{family.name}</h2>
              <p className="text-xs text-muted-foreground">
                {formatEUR(family.price_cents)} pièce
                {hasSub && pickedSub && <> · {pickedSub}</>}
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 text-muted-foreground shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Étape 1 : choix sous-catégorie (Homme/Femme) */}
        {hasSub && pickedSub === null && (
          <div className="space-y-3">
            {subGroups.map((g) => {
              const stock = Math.max(0, g.items.reduce((s, v) => s + v.stock, 0));
              const sold = soldForGroup(g.items);
              return (
                <button
                  key={g.subcategory}
                  onClick={() => setPickedSub(g.subcategory!)}
                  className="w-full flex items-center gap-3 bg-muted/50 hover:bg-muted rounded-2xl p-4 active:scale-[.98] transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-2xl">{g.subcategory}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      stock {stock}{sold > 0 && <> · vendus {sold}</>}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        {/* Étape 2 : tailles */}
        {currentGroup && (
          <ul className="space-y-2">
            {currentGroup.items.map((v) => {
              const count = countFor(v.id);
              const lowStock = v.stock <= family.low_alert;
              return (
                <li key={v.id} className="flex items-center gap-3 bg-muted/50 rounded-xl p-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-2xl">{v.label ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      stock <span className={lowStock ? "text-destructive font-semibold" : ""}>{Math.max(0, v.stock)}</span>
                      {count > 0 && <> · vendus {count}</>}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(v)}
                    disabled={count === 0}
                    className="w-11 h-11 rounded-full border border-border flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                  >
                    <span className="text-xl leading-none">−</span>
                  </button>
                  <button
                    onClick={() => onAdd(v)}
                    disabled={v.stock <= 0}
                    className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConcertPickerModal({
  concerts, currentId, onPick, onNew, onClose,
}: {
  concerts: Concert[];
  currentId: string;
  onPick: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  useBackHandler(true, onClose);
  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Choisir un concert</h2>
          <button onClick={onNew} className="inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md">
            <Calendar className="h-4 w-4" /> Nouveau
          </button>
        </div>
        <ul className="space-y-2">
          {concerts.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onPick(c.id)}
                className={`w-full text-left px-3 py-3 rounded-xl border ${
                  c.id === currentId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{c.name}</div>
                  {c.is_closed && (
                    <span className="text-[9px] uppercase tracking-wider bg-background/40 px-1.5 py-0.5 rounded">
                      Clôturé
                    </span>
                  )}
                  {c.is_active && !c.is_closed && c.id !== currentId && (
                    <span className="text-[9px] uppercase tracking-wider bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      Actif
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-80">
                  {new Date(c.concert_date).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

