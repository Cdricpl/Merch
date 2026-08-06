import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Plus, Minus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import {
  createFamily,
  createVariant,
  deleteFamily,
  deleteVariant,
  replenishVariant,
  updateFamily,
  updateVariant,
} from "../lib/db";
import type { Family, Variant } from "../lib/types";

export function StockTab() {
  const { families, variants, sales } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const grouped = useMemo(() => {
    return families.map((f) => ({
      family: f,
      items: variants.filter((v) => v.family_id === f.id),
    }));
  }, [families, variants]);

  return (
    <div className="px-4 pt-4 space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Stock global</div>

      <div className="space-y-2">
        {grouped.map(({ family, items }) => {
          const total = items.reduce((s, x) => s + x.stock, 0);
          const isOpen = openId === family.id;
          const lowStock = total <= family.low_alert;
          return (
            <div key={family.id} className="bg-card border border-border rounded-lg">
              <button
                onClick={() => setOpenId(isOpen ? null : family.id)}
                className="w-full flex items-center gap-2 p-3 text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{family.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatEUR(family.price_cents)} · {items.length} variante{items.length > 1 ? "s" : ""}
                  </div>
                </div>
                <div className={`font-display text-2xl ${lowStock ? "text-destructive" : ""}`}>{total}</div>
              </button>

              {isOpen && (
                <FamilyEditor
                  family={family}
                  variants={items}
                  saleIds={sales.filter((s) => items.some((v) => v.id === s.variant_id)).map((s) => s.id)}
                />
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setAddOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-muted-foreground"
      >
        <Plus className="h-4 w-4" /> Nouvelle famille de produit
      </button>

      {addOpen &&
        createPortal(<AddFamilyModal onClose={() => setAddOpen(false)} />, document.body)}
    </div>
  );
}

function FamilyEditor({
  family,
  variants,
  saleIds,
}: {
  family: Family;
  variants: Variant[];
  saleIds: string[];
}) {
  const [replenishFor, setReplenishFor] = useState<Variant | null>(null);
  const [addVariantOpen, setAddVariantOpen] = useState(false);

  const setPrice = async (cents: number) => {
    try { await updateFamily(family.id, { price_cents: cents }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const setName = async (name: string) => {
    if (!name.trim()) return;
    try { await updateFamily(family.id, { name: name.trim() }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const setLowAlert = async (n: number) => {
    try { await updateFamily(family.id, { low_alert: Math.max(0, n) }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const removeFamily = async () => {
    if (!confirm(`Supprimer "${family.name}" et toutes ses variantes ?`)) return;
    try {
      await deleteFamily(family.id, variants.map((v) => v.id), saleIds);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setStock = async (variant: Variant, stock: number) => {
    const safe = Math.max(0, Math.floor(stock));
    try { await updateVariant(variant.id, { stock: safe }); }
    catch (e) { toast.error((e as Error).message); }
  };

  const removeVariant = async (variant: Variant) => {
    if (!confirm(`Supprimer la taille ${variant.label ?? "—"} ?`)) return;
    try { await deleteVariant(variant.id); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="border-t border-border p-3 space-y-3">
      <input
        defaultValue={family.name}
        onBlur={(e) => e.target.value !== family.name && setName(e.target.value)}
        className="w-full rounded-md bg-input border border-border px-3 py-2"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="rounded-md bg-muted px-2 py-2 block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Prix (€)</div>
          <input
            type="number"
            step="0.5"
            defaultValue={(family.price_cents / 100).toString()}
            onBlur={(e) => {
              const cents = Math.round(parseFloat(e.target.value || "0") * 100);
              if (cents !== family.price_cents) setPrice(cents);
            }}
            className="w-full bg-transparent text-lg font-display outline-none"
          />
        </label>
        <label className="rounded-md bg-muted px-2 py-2 block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Alerte à</div>
          <input
            type="number"
            min={0}
            defaultValue={family.low_alert.toString()}
            onBlur={(e) => {
              const n = parseInt(e.target.value || "0");
              if (n !== family.low_alert) setLowAlert(n);
            }}
            className="w-full bg-transparent text-lg font-display outline-none"
          />
        </label>
      </div>

      <div className="space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Variantes</div>
        {variants.map((v) => {
          const low = v.stock <= family.low_alert;
          return (
            <div key={v.id} className="flex items-center gap-2 bg-muted rounded-lg px-2 py-2">
              <div className="w-14 font-display text-lg">{v.label ?? "—"}</div>
              <button
                onClick={() => setStock(v, v.stock - 1)}
                disabled={v.stock <= 0}
                aria-label="Retirer 1"
                className="w-9 h-9 rounded-md border border-border flex items-center justify-center active:scale-90 disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                type="number"
                min={0}
                value={v.stock}
                onChange={(e) => setStock(v, parseInt(e.target.value || "0"))}
                className={`flex-1 min-w-0 bg-transparent text-center text-2xl font-display outline-none ${
                  low ? "text-destructive" : ""
                }`}
              />
              <button
                onClick={() => setStock(v, v.stock + 1)}
                aria-label="Ajouter 1"
                className="w-9 h-9 rounded-md border border-border flex items-center justify-center active:scale-90"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setReplenishFor(v)}
                aria-label="Réapprovisionner"
                className="px-3 h-9 rounded-md bg-primary text-primary-foreground text-sm font-semibold active:scale-90"
              >
                +N
              </button>
              <button
                onClick={() => removeVariant(v)}
                aria-label="Supprimer la variante"
                className="p-2 text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
        <button
          onClick={() => setAddVariantOpen(true)}
          className="w-full text-sm text-muted-foreground py-2 rounded-md border border-dashed border-border"
        >
          <Plus className="h-3 w-3 inline mr-1" />
          Ajouter une taille
        </button>
      </div>

      <button
        onClick={removeFamily}
        className="w-full inline-flex items-center justify-center gap-2 text-sm text-destructive py-2"
      >
        <Trash2 className="h-4 w-4" /> Supprimer ce produit
      </button>

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
            onClose={() => setAddVariantOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}

function ReplenishModal({
  variant,
  familyName,
  onClose,
}: {
  variant: Variant;
  familyName: string;
  onClose: () => void;
}) {
  const [n, setN] = useState("10");
  const [busy, setBusy] = useState(false);

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
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <div>
          <h2 className="font-display text-xl">Réapprovisionner</h2>
          <p className="text-sm text-muted-foreground">
            {familyName} — {variant.label ?? "—"} (stock actuel : {variant.stock})
          </p>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Quantité à ajouter</div>
          <input
            type="number"
            min={1}
            value={n}
            onChange={(e) => setN(e.target.value)}
            className="w-full rounded-md bg-input border border-border px-3 py-3 text-2xl font-display"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          {[5, 10, 20, 50].map((v) => (
            <button
              key={v}
              onClick={() => setN(String(v))}
              className="flex-1 rounded-md bg-muted py-2 text-sm font-semibold"
            >
              +{v}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50"
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

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createFamily(name.trim(), Math.round(parseFloat(price || "0") * 100));
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <h2 className="font-display text-xl">Nouveau produit</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom (ex : T-shirt Nouveau modèle)"
          className="w-full rounded-md bg-input border border-border px-3 py-3"
        />
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prix (€)</div>
          <input
            type="number"
            step="0.5"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-md bg-input border border-border px-3 py-3"
          />
        </label>
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50"
        >
          {busy ? "…" : "Créer"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Une variante par défaut sera créée. Ajoute les tailles dans le détail du produit.
        </p>
      </div>
    </div>
  );
}

function AddVariantModal({
  familyId,
  onClose,
}: {
  familyId: string;
  onClose: () => void;
}) {
  const [label, setLabel] = useState("");
  const [stock, setStock] = useState("0");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await createVariant(familyId, label.trim() || null, parseInt(stock || "0"));
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        <h2 className="font-display text-xl">Nouvelle taille</h2>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex : XL, 2XL, ou vide"
          className="w-full rounded-md bg-input border border-border px-3 py-3"
          autoFocus
        />
        <label className="block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Stock initial</div>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            className="w-full rounded-md bg-input border border-border px-3 py-3"
          />
        </label>
        <button
          onClick={create}
          disabled={busy}
          className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50"
        >
          {busy ? "…" : "Ajouter"}
        </button>
      </div>
    </div>
  );
}
