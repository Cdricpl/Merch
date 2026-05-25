import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Product = {
  id: string;
  name: string;
  variant: string | null;
  price_cents: number;
  stock: number;
  sort_order: number;
};

export function InventoryTab({ bandId }: { bandId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, variant, price_cents, stock, sort_order")
      .eq("band_id", bandId)
      .order("sort_order");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setProducts((data ?? []) as Product[]);
  }, [bandId]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime : when stock changes via sales trigger or other devices, sync the list
  useEffect(() => {
    const ch = supabase
      .channel(`inventory-products:${bandId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `band_id=eq.${bandId}` }, (payload) => {
        if (payload.eventType === "INSERT") {
          setProducts((prev) => [...prev, payload.new as Product].sort((a, b) => a.sort_order - b.sort_order));
        } else if (payload.eventType === "UPDATE") {
          setProducts((prev) => prev.map((p) => p.id === (payload.new as Product).id ? payload.new as Product : p));
        } else if (payload.eventType === "DELETE") {
          setProducts((prev) => prev.filter((p) => p.id !== (payload.old as Product).id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bandId]);

  const updateStock = async (productId: string, stock: number) => {
    const safe = Math.max(0, Math.floor(stock));
    setProducts((p) => p.map((x) => x.id === productId ? { ...x, stock: safe } : x));
    const { error } = await supabase.from("products").update({ stock: safe }).eq("id", productId);
    if (error) toast.error(error.message);
  };

  const updatePrice = async (productId: string, priceCents: number) => {
    setProducts((p) => p.map((x) => x.id === productId ? { ...x, price_cents: priceCents } : x));
    const { error } = await supabase.from("products").update({ price_cents: priceCents }).eq("id", productId);
    if (error) toast.error(error.message);
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return toast.error(error.message);
    setProducts((p) => p.filter((x) => x.id !== productId));
  };

  return (
    <div className="px-4 pt-4 space-y-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">Stock global</div>

      <div className="space-y-2">
        {loading && products.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-lg" />)
        ) : null}

        {products.map((p) => (
          <div key={p.id} className="bg-card border border-border rounded-lg p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold">
                  {p.name}{p.variant && <span className="text-primary"> — {p.variant}</span>}
                </div>
              </div>
              <button onClick={() => deleteProduct(p.id)} aria-label="Supprimer cet article" className="p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <NumField label="Stock" value={p.stock}
                onChange={(v) => updateStock(p.id, v)} />
              <NumField label="Prix (€)" value={p.price_cents / 100} step={0.5}
                onChange={(v) => updatePrice(p.id, Math.round(v * 100))} />
            </div>
          </div>
        ))}

        {!loading && products.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Aucun article. Ajoute ton stock ci-dessous.</p>
        )}
      </div>

      <button onClick={() => setShowAdd(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-muted-foreground">
        <Plus className="h-4 w-4" /> Ajouter un article
      </button>

      {showAdd && <AddProductSheet bandId={bandId} onClose={() => setShowAdd(false)} onCreated={reload} />}
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="rounded-md bg-muted px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <input
        type="number" min={0} step={step ?? 1} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value || "0"))}
        className="w-full bg-transparent text-lg font-display outline-none"
      />
    </div>
  );
}

function AddProductSheet({ bandId, onClose, onCreated }: { bandId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [variant, setVariant] = useState("");
  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("15");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("products").insert({
      band_id: bandId,
      name: name.trim(),
      variant: variant.trim() || null,
      price_cents: Math.round(parseFloat(price || "0") * 100),
      stock: Math.max(0, parseInt(stock || "0")),
      sort_order: 100,
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
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex: T-shirt)"
          className="w-full rounded-md bg-input border border-border px-3 py-3" autoFocus />
        <input value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Variante (S, M, L… optionnel)"
          className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-1">Stock</div>
            <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)}
              className="w-full rounded-md bg-input border border-border px-3 py-3" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 mb-1">Prix (€)</div>
            <input type="number" step="0.5" value={price} onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md bg-input border border-border px-3 py-3" />
          </div>
        </div>
        <button onClick={create} disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50">Créer</button>
      </div>
    </div>
  );
}
