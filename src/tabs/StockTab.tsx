import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  Plus, Minus, Trash2, ChevronLeft, ChevronRight,
  Image as ImageIcon, X, Package,
} from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { levelBar, levelFor, levelText, ORANGE_MAX, RED_MAX } from "../lib/stockLevel";
import { parseName } from "../lib/category";
import {
  createFamily, createVariant, deleteFamily, deleteVariant,
  replenishVariant, updateFamily, updateVariant,
} from "../lib/db";
import { fileToCompressedDataUrl } from "../lib/image";
import { StockBadge } from "../components/StockBadge";
import { VariantBar } from "../components/VariantBar";
import { useBackHandler } from "../lib/useBackHandler";
import type { Family, Variant } from "../lib/types";

export function StockTab() {
  const { families, variants, sales } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  // App remonte le composant (clé), ce qui rejoue cet état initial — plutôt
  // qu'un effet qui déclencherait un rendu en cascade.
  const [addOpen, setAddOpen] = useState(false);

  // ⚠️ Tous les hooks doivent rester AVANT le retour anticipé du détail produit :
  // un hook appelé seulement dans la vue liste change le nombre de hooks entre
  // les deux rendus, ce que React refuse (erreur #300).
  const variantsByFamily = useMemo(() => {
    const m = new Map<string, Variant[]>();
    for (const v of variants) {
      const arr = m.get(v.family_id);
      if (arr) arr.push(v);
      else m.set(v.family_id, [v]);
    }
    return m;
  }, [variants]);

  const grouped = useMemo(
    () =>
      families.map((f) => {
        const items = variantsByFamily.get(f.id) ?? [];
        return {
          family: f,
          items,
          total: items.reduce((s, x) => s + x.stock, 0),
          lowCount: items.reduce((n, x) => n + (x.stock <= RED_MAX ? 1 : 0), 0),
        };
      }),
    [families, variantsByFamily]
  );

  const openFamily = openId ? families.find((x) => x.id === openId) : undefined;

  const openFamilyVariants = useMemo(
    () => variantsByFamily.get(openId ?? "") ?? [],
    [variantsByFamily, openId]
  );
  const openFamilySaleIds = useMemo(() => {
    if (!openFamily) return [];
    const ids = new Set(openFamilyVariants.map((v) => v.id));
    return sales.filter((s) => ids.has(s.variant_id)).map((s) => s.id);
  }, [openFamily, openFamilyVariants, sales]);

  if (openFamily) {
    return (
      <FamilyDetail
        family={openFamily}
        variants={openFamilyVariants}
        saleIds={openFamilySaleIds}
        onBack={() => setOpenId(null)}
        onDeleted={() => setOpenId(null)}
      />
    );
  }

  return (
    <div className="px-4 pt-1 space-y-3 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px]">Stock</h1>
        <button
          onClick={() => setAddOpen(true)}
          aria-label="Nouveau produit"
          className="w-9 h-9 rounded-full btn-primary flex items-center justify-center active:scale-90 transition"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2">
        {grouped.map(({ family, items, total, lowCount }) => {
          const { category, display } = parseName(family.name);
          return (
            <button
              key={family.id}
              onClick={() => setOpenId(family.id)}
              className="card-surface w-full flex items-center gap-3 rounded-2xl p-3 text-left active:opacity-80 transition"
            >
              <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0">
                {family.image && <img src={family.image} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                {category && (
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{category}</div>
                )}
                <div className="font-semibold text-sm truncate">{display}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatEUR(family.price_cents)} · {items.length} taille{items.length > 1 ? "s" : ""}
                </div>
              </div>
              <StockBadge stock={total} lowCount={lowCount} />
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}

        {grouped.length === 0 && (
          <p className="text-center text-muted-foreground py-12 text-sm">
            Aucun produit. Tape sur le <Plus className="inline h-3 w-3" /> en haut pour en créer.
          </p>
        )}
      </div>

      {addOpen &&
        createPortal(<AddFamilyModal onClose={() => setAddOpen(false)} />, document.body)}
    </div>
  );
}

function FamilyDetail({
  family, variants, saleIds, onBack, onDeleted,
}: {
  family: Family;
  variants: Variant[];
  saleIds: string[];
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [replenishFor, setReplenishFor] = useState<Variant | null>(null);
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useBackHandler(true, onBack);

  const total = variants.reduce((s, x) => s + x.stock, 0);
  const maxStock = variants.reduce((m, x) => Math.max(m, x.stock), 0);
  const { category, display } = parseName(family.name);
  const level = levelFor(total);

  const onImageChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImg(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      if (dataUrl.length > 900_000) {
        toast.error("Image trop lourde après compression");
      } else {
        await updateFamily(family.id, { image: dataUrl });
        toast.success("Image mise à jour");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setUploadingImg(false); }
  };

  const clearImage = async () => {
    try { await updateFamily(family.id, { image: null }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const setPrice = async (cents: number) => {
    try { await updateFamily(family.id, { price_cents: cents }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const setName = async (name: string) => {
    if (!name.trim()) return;
    try { await updateFamily(family.id, { name: name.trim() }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const removeFamily = async () => {
    if (!confirm(`Supprimer "${family.name}" ?`)) return;
    try {
      await deleteFamily(family.id, variants.map((v) => v.id), saleIds);
      onDeleted();
    } catch (e) { toast.error((e as Error).message); }
  };

  const bumpStock = async (v: Variant, delta: number) => {
    const next = Math.max(0, v.stock + delta);
    try { await updateVariant(v.id, { stock: next }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const removeVariant = async (v: Variant) => {
    if (!confirm(`Supprimer la taille ${v.label ?? "—"} ?`)) return;
    try { await deleteVariant(v.id); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="px-4 pt-1 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} aria-label="Retour" className="inline-flex items-center gap-2 -ml-1">
          <ChevronLeft className="h-5 w-5 text-foreground" />
          <span className="font-display text-[22px]">Stock</span>
        </button>
        <button
          onClick={() => setEditMode((v) => !v)}
          className="text-[13px] text-primary font-semibold px-1 py-1"
        >
          {editMode ? "OK" : "Modifier"}
        </button>
      </div>

      {/* Carte produit */}
      <div className="card-surface rounded-2xl p-3.5">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0">
            {family.image ? (
              <img src={family.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Package className="h-6 w-6" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {category && (
              <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {category}
              </div>
            )}
            <div className="font-display text-[19px] leading-tight truncate">{display}</div>
            <div className="text-[13px] text-muted-foreground mt-0.5">{formatEUR(family.price_cents)}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Stock total
            </div>
            <div className={`font-display text-[2.25rem] leading-none mt-0.5 ${levelText(level)}`}>{total}</div>
          </div>
        </div>

        {/* Jauge du total, rapportée au plus gros stock jamais atteint sur ce
            produit — sinon une famille bien fournie afficherait une barre pleine
            en permanence. */}
        <div className="gauge mt-3">
          <span
            className={levelBar(level)}
            style={{ width: `${Math.min(100, Math.round((total / Math.max(1, maxStock * variants.length)) * 100))}%` }}
          />
        </div>
        <div className={`text-[11px] mt-1.5 ${levelText(level)}`}>
          {total <= RED_MAX ? "À réassortir" : total <= ORANGE_MAX ? "Stock bas" : "Stock confortable"}
        </div>
      </div>

      {/* Image editor (only in edit mode) */}
      {editMode && (
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChosen} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImg}
            className="flex-1 inline-flex items-center justify-center gap-2 text-xs rounded-md border border-border px-3 py-2 disabled:opacity-50"
          >
            <ImageIcon className="h-3 w-3" />
            {uploadingImg ? "Compression…" : family.image ? "Changer l'image" : "Ajouter une image"}
          </button>
          {family.image && (
            <button onClick={clearImage} className="text-xs text-destructive inline-flex items-center gap-1">
              <X className="h-3 w-3" /> Retirer
            </button>
          )}
        </div>
      )}

      {/* Edit fields */}
      {editMode && (
        <div className="space-y-2">
          <input
            defaultValue={family.name}
            onBlur={(e) => e.target.value !== family.name && setName(e.target.value)}
            className="w-full rounded-xl bg-input border border-border px-3 py-3"
          />
          <label className="rounded-xl bg-muted px-3 py-2 block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Prix (€)</div>
            <input
              type="number" step="0.5"
              defaultValue={(family.price_cents / 100).toString()}
              onBlur={(e) => {
                const cents = Math.round(parseFloat(e.target.value || "0") * 100);
                if (cents !== family.price_cents) setPrice(cents);
              }}
              className="w-full bg-transparent text-lg font-display outline-none"
            />
          </label>
        </div>
      )}

      {/* Variants grouped by subcategory */}
      {(() => {
        const groups: Array<{ subcategory: string | null; items: Variant[] }> = [];
        const seen = new Map<string, Variant[]>();
        for (const v of variants) {
          const key = v.subcategory ?? "";
          if (!seen.has(key)) {
            seen.set(key, []);
            groups.push({ subcategory: v.subcategory ?? null, items: seen.get(key)! });
          }
          seen.get(key)!.push(v);
        }
        return (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.subcategory ?? "_flat"} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {g.subcategory ?? "Par taille"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {g.items.reduce((s, v) => s + v.stock, 0)} en stock
                  </div>
                </div>
                <div className="card-surface rounded-2xl divide-y divide-border">
                  {g.items.map((v) => (
                    <div key={v.id} className="flex items-center">
                      <div className="flex-1 min-w-0">
                        {/* La ligne entière ouvre le réappro : le chevron de la
                            maquette annonce déjà une action, un bouton « +N » en
                            plus n'ajouterait rien. */}
                        <VariantBar
                          variant={v}
                          maxStock={Math.max(1, maxStock)}
                          onClick={() => setReplenishFor(v)}
                        />
                      </div>
                      {editMode && (
                        <div className="flex items-center gap-1 pr-2">
                          <button
                            onClick={() => bumpStock(v, -1)}
                            disabled={v.stock <= 0}
                            aria-label="Retirer 1"
                            className="w-8 h-8 rounded-md border border-border flex items-center justify-center active:scale-90 disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => bumpStock(v, 1)}
                            aria-label="Ajouter 1"
                            className="w-8 h-8 rounded-md border border-border flex items-center justify-center active:scale-90"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setReplenishFor(v)}
                            aria-label="Réapprovisionner"
                            className="px-2 h-8 rounded-md bg-primary text-primary-foreground text-xs font-semibold active:scale-90"
                          >
                            +N
                          </button>
                          <button
                            onClick={() => removeVariant(v)}
                            aria-label="Supprimer la taille"
                            className="w-8 h-8 flex items-center justify-center text-muted-foreground"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {editMode && (
              <button
                onClick={() => setAddVariantOpen(true)}
                className="w-full text-sm text-muted-foreground py-2 rounded-md border border-dashed border-border inline-flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3" /> Ajouter une taille
              </button>
            )}
          </div>
        );
      })()}

      {editMode && (
        <button
          onClick={removeFamily}
          className="w-full inline-flex items-center justify-center gap-2 text-sm text-destructive py-2 rounded-xl border border-border"
        >
          <Trash2 className="h-4 w-4" /> Supprimer ce produit
        </button>
      )}

      {replenishFor &&
        createPortal(
          <ReplenishModal
            variant={replenishFor}
            familyName={family.name}
            onClose={() => setReplenishFor(null)}
          />,
          document.body
        )}

      {addVariantOpen &&
        createPortal(
          <AddVariantModal
            familyId={family.id}
            subcategories={Array.from(new Set(variants.map((v) => v.subcategory).filter((s): s is string => !!s)))}
            onClose={() => setAddVariantOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}

function ReplenishModal({
  variant, familyName, onClose,
}: {
  variant: Variant;
  familyName: string;
  onClose: () => void;
}) {
  const [n, setN] = useState("10");
  const [busy, setBusy] = useState(false);
  useBackHandler(true, onClose);

  const submit = async () => {
    const add = parseInt(n || "0");
    if (add <= 0) return;
    setBusy(true);
    try {
      await replenishVariant(variant.id, add);
      toast.success(`+${add} ajoutés`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />
        <div>
          <h2 className="font-display text-xl">Réapprovisionner</h2>
          <p className="text-sm text-muted-foreground">
            {familyName} — {variant.label ?? "—"} · stock actuel : <span className="font-semibold text-foreground">{variant.stock}</span>
          </p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Quantité à ajouter</div>
          <input
            type="number" min={1} value={n}
            onChange={(e) => setN(e.target.value)}
            className="w-full rounded-xl bg-input border border-border px-3 py-3 text-2xl font-display"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[5, 10, 20, 50].map((v) => (
            <button
              key={v}
              onClick={() => setN(String(v))}
              className={`rounded-md py-2 text-sm font-semibold ${n === String(v) ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            >
              +{v}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-xl btn-primary font-display tracking-wider py-3 disabled:opacity-50"
        >
          {busy ? "…" : `Ajouter ${n} au stock`}
        </button>
      </div>
    </div>
  );
}

function AddFamilyModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("20");
  const [busy, setBusy] = useState(false);
  useBackHandler(true, onClose);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createFamily(name.trim(), Math.round(parseFloat(price || "0") * 100));
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />
        <h2 className="font-display text-xl">Nouveau produit</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex : T-shirt Nouveau modèle)"
          className="w-full rounded-xl bg-input border border-border px-3 py-3"
        />
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prix (€)</div>
          <input
            type="number" step="0.5" value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-xl bg-input border border-border px-3 py-3"
          />
        </label>
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="w-full rounded-xl btn-primary font-display tracking-wider py-3 disabled:opacity-50"
        >
          {busy ? "…" : "Créer"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Une variante par défaut est créée. Ajoute les tailles dans le détail du produit.
        </p>
      </div>
    </div>
  );
}

function AddVariantModal({
  familyId, onClose, subcategories,
}: {
  familyId: string;
  onClose: () => void;
  subcategories: string[];
}) {
  const [subcategory, setSubcategory] = useState<string>(subcategories[0] ?? "");
  const [customSub, setCustomSub] = useState("");
  const [label, setLabel] = useState("");
  const [stock, setStock] = useState("0");
  const [busy, setBusy] = useState(false);
  useBackHandler(true, onClose);

  const create = async () => {
    setBusy(true);
    try {
      const sub = (customSub.trim() || subcategory.trim()) || null;
      await createVariant(
        familyId,
        label.trim() || null,
        parseInt(stock || "0"),
        sub,
      );
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-3xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div className="w-10 h-1 rounded-full bg-muted mx-auto" />
        <h2 className="font-display text-xl">Nouvelle taille</h2>

        {subcategories.length > 0 && (
          <label className="block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sous-catégorie</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {subcategories.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSubcategory(s); setCustomSub(""); }}
                  className={`px-3 py-1.5 rounded-md text-sm ${!customSub && subcategory === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </label>
        )}
        <input
          value={customSub}
          onChange={(e) => setCustomSub(e.target.value)}
          placeholder={subcategories.length > 0 ? "…ou nouvelle sous-catégorie" : "Sous-catégorie (Homme, Femme… vide si aucune)"}
          className="w-full rounded-xl bg-input border border-border px-3 py-2 text-sm"
        />

        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Taille</div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : S, M, L, XL, 2XL, ou vide"
            className="w-full rounded-xl bg-input border border-border px-3 py-3"
          />
        </label>
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stock initial</div>
          <input
            type="number" min={0} value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full rounded-xl bg-input border border-border px-3 py-3"
          />
        </label>
        <button
          onClick={create}
          disabled={busy}
          className="w-full rounded-xl btn-primary font-display tracking-wider py-3 disabled:opacity-50"
        >
          {busy ? "…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
