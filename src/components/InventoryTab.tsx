import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConcerts } from "@/hooks/useConcerts";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Product = { id: string; name: string; variant: string | null; price_cents: number; sort_order: number };
type Inv = { id: string; product_id: string; initial_stock: number; manual_remaining: number | null };
type SaleAgg = Record<string, number>;

export function InventoryTab({ bandId }: { bandId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [concertId, setConcertId] = useState<string | null>(null);
  const [inv, setInv] = useState<Inv[]>([]);
  const [sold, setSold] = useState<SaleAgg>({});
  const [showAdd, setShowAdd] = useState(false);

  const { concerts, loading: loadingConcerts } = useConcerts(bandId);

  const reloadProducts = useCallback(async () => {
    setLoadingProducts(true);
    const { data, error } = await supabase.from("products").select("*").eq("band_id", bandId).order("sort_order");
    setLoadingProducts(false);
    if (error) { toast.error(error.message); return; }
    setProducts((data ?? []) as Product[]);
  }, [bandId]);

  useEffect(() => { reloadProducts(); }, [reloadProducts]);

  // Auto-select active concert on initial load
  useEffect(() => {
    if (!concertId && concerts.length > 0) {
      const active = concerts.find((c) => c.is_active) ?? concerts[0];
      setConcertId(active?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concerts]);

  useEffect(() => {
    if (!concertId) { setInv([]); setSold({}); return; }
    supabase.from("inventory").select("id, product_id, initial_stock, manual_remaining").eq("concert_id", concertId)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setInv((data ?? []) as Inv[]);
      });
    supabase.from("sales").select("product_id, quantity").eq("concert_id", concertId)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        const agg: SaleAgg = {};
        (data ?? []).forEach((s: { product_id: string; quantity: number }) => {
          agg[s.product_id] = (agg[s.product_id] ?? 0) + s.quantity;
        });
        setSold(agg);
      });
  }, [concertId]);

  const setInitial = async (productId: string, value: number) => {
    if (!concertId) return;
    const existing = inv.find((i) => i.product_id === productId);
    if (existing) {
      const { error } = await supabase.from("inventory").update({ initial_stock: value }).eq("id", existing.id);
      if (error) return toast.error(error.message);
      setInv((p) => p.map((i) => i.id === existing.id ? { ...i, initial_stock: value } : i));
    } else {
      const { data, error } = await supabase.from("inventory")
        .insert({ concert_id: concertId, band_id: bandId, product_id: productId, initial_stock: value })
        .select().single();
      if (error) return toast.error(error.message);
      setInv((p) => [...p, data as Inv]);
    }
  };

  const setManualRemaining = async (productId: string, value: number | null) => {
    if (!concertId) return;
    const existing = inv.find((i) => i.product_id === productId);
    if (existing) {
      const { error } = await supabase.from("inventory").update({ manual_remaining: value }).eq("id", existing.id);
      if (error) return toast.error(error.message);
      setInv((p) => p.map((i) => i.id === existing.id ? { ...i, manual_remaining: value } : i));
    } else {
      const { data, error } = await supabase.from("inventory")
        .insert({ concert_id: concertId, band_id: bandId, product_id: productId, initial_stock: 0, manual_remaining: value })
        .select().single();
      if (error) return toast.error(error.message);
      if (data) setInv((p) => [...p, data as Inv]);
    }
  };

  const updatePrice = async (productId: string, priceCents: number) => {
    const { error } = await supabase.from("products").update({ price_cents: priceCents }).eq("id", productId);
    if (error) return toast.error(error.message);
    setProducts((p) => p.map((x) => x.id === productId ? { ...x, price_cents: priceCents } : x));
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return toast.error(error.message);
    setProducts((p) => p.filter((x) => x.id !== productId));
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <div>
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Concert</label>
        <select
          value={concertId ?? ""}
          onChange={(e) => setConcertId(e.target.value || null)}
          className="mt-1 w-full rounded-md bg-input border border-border px-3 py-2"
        >
          {concerts.length === 0 && <option value="">— Aucun concert —</option>}
          {concerts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {new Date(c.concert_date).toLocaleDateString("fr-BE")}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {(loadingProducts || loadingConcerts) && products.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-lg" />)
        ) : null}
        {products.map((p) => {
          const i = inv.find((x) => x.product_id === p.id);
          const initial = i?.initial_stock ?? 0;
          const soldQty = sold[p.id] ?? 0;
          const remaining = i?.manual_remaining ?? Math.max(0, initial - soldQty);
          return (
            <div key={p.id} className="bg-card border border-border rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{p.name}{p.variant && <span className="text-primary"> — {p.variant}</span>}</div>
                  <div className="text-xs text-muted-foreground">Vendus : {soldQty}</div>
                </div>
                <button onClick={() => deleteProduct(p.id)} aria-label="Supprimer cet article" className="p-2 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <NumField label="Stock initial" value={initial} disabled={!concertId}
                  onChange={(v) => setInitial(p.id, v)} />
                <div className="rounded-md bg-muted px-2 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Restant</div>
                  <input
                    type="number" min={0} value={remaining}
                    disabled={!concertId}
                    onChange={(e) => setManualRemaining(p.id, e.target.value === "" ? null : Math.max(0, parseInt(e.target.value || "0")))}
                    className="w-full bg-transparent text-lg font-display text-primary outline-none"
                  />
                </div>
                <NumField label="Prix (€)" value={p.price_cents / 100} step={0.5}
                  onChange={(v) => updatePrice(p.id, Math.round(v * 100))} />
              </div>
              {i?.manual_remaining != null && (
                <button onClick={() => setManualRemaining(p.id, null)} className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1">
                  <X className="h-3 w-3" /> Effacer correction (auto = {Math.max(0, initial - soldQty)})
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setShowAdd(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-muted-foreground">
        <Plus className="h-4 w-4" /> Ajouter un article
      </button>

      {showAdd && <AddProductSheet bandId={bandId} onClose={() => setShowAdd(false)} onCreated={reloadProducts} />}
    </div>
  );
}

function NumField({ label, value, onChange, disabled, step }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean; step?: number }) {
  return (
    <div className="rounded-md bg-muted px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type="number" min={0} step={step ?? 1} value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        className="w-full bg-transparent text-lg font-display outline-none"
      />
    </div>
  );
}

function AddProductSheet({ bandId, onClose, onCreated }: { bandId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [price, setPrice] = useState("20");
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      band_id: bandId, name: name.trim(), variant: variant.trim() || null,
      price_cents: Math.round(parseFloat(price || "0") * 100), sort_order: 100,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    onCreated();
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-end" onClick={onClose}>
      <div className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl">Nouvel article</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex: Hoodie)" className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Variante (S, M, L… optionnel)" className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Prix €" className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <button onClick={create} disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50">Créer</button>
      </div>
    </div>
  );
}
