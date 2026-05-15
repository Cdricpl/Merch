import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConcerts, type Concert } from "@/hooks/useConcerts";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Minus, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Product = { id: string; name: string; variant: string | null; price_cents: number; sort_order: number };
type SaleRow = { id: string; product_id: string; quantity: number; unit_price_cents: number };

export function SalesTab({ bandId }: { bandId: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [concert, setConcert] = useState<Concert | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [picker, setPicker] = useState(false);
  const [showNewConcert, setShowNewConcert] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const { concerts, reload: reloadConcerts, loading: loadingConcerts } = useConcerts(bandId);

  // Load current user for sold_by tracking
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Load products
  useEffect(() => {
    setLoadingProducts(true);
    supabase.from("products").select("*").eq("band_id", bandId).order("sort_order")
      .then(({ data, error }) => {
        setLoadingProducts(false);
        if (error) { toast.error(error.message); return; }
        setProducts((data ?? []) as Product[]);
      });
  }, [bandId]);

  // Auto-select concert on initial load only
  useEffect(() => {
    if (!concert && concerts.length > 0) {
      setConcert(concerts.find((c) => c.is_active) ?? concerts[0] ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concerts]);

  // Load sales for current concert + realtime
  useEffect(() => {
    if (!concert) { setSales([]); return; }
    supabase.from("sales").select("id, product_id, quantity, unit_price_cents").eq("concert_id", concert.id)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setSales((data ?? []) as SaleRow[]);
      });

    const ch = supabase
      .channel(`sales:${concert.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter: `concert_id=eq.${concert.id}` }, (payload) => {
        setSales((prev) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as SaleRow;
            if (prev.find((p) => p.id === row.id)) return prev;
            return [...prev, row];
          }
          if (payload.eventType === "DELETE") {
            return prev.filter((p) => p.id !== (payload.old as SaleRow).id);
          }
          if (payload.eventType === "UPDATE") {
            const row = payload.new as SaleRow;
            return prev.map((p) => p.id === row.id ? row : p);
          }
          return prev;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [concert?.id]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach((s) => map.set(s.product_id, (map.get(s.product_id) ?? 0) + s.quantity));
    return map;
  }, [sales]);

  const totalCents = useMemo(() => sales.reduce((sum, s) => sum + s.quantity * s.unit_price_cents, 0), [sales]);
  const totalItems = useMemo(() => sales.reduce((sum, s) => sum + s.quantity, 0), [sales]);

  const addSale = async (p: Product) => {
    if (!concert) return;
    if (navigator.vibrate) navigator.vibrate(30);
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimistic: SaleRow = { id: tempId, product_id: p.id, quantity: 1, unit_price_cents: p.price_cents };
    setSales((prev) => [...prev, optimistic]);
    const { data, error } = await supabase.from("sales").insert({
      concert_id: concert.id, product_id: p.id, band_id: bandId,
      quantity: 1, unit_price_cents: p.price_cents,
      sold_by: userId,
    }).select("id, product_id, quantity, unit_price_cents").single();
    if (error) {
      setSales((prev) => prev.filter((s) => s.id !== tempId));
      toast.error("Erreur : " + error.message);
    } else if (data) {
      setSales((prev) => prev.map((s) => s.id === tempId ? data as SaleRow : s));
    }
  };

  const removeSale = async (productId: string) => {
    if (!concert) return;
    const candidate = sales[sales.findLastIndex((s) => s.product_id === productId)];
    if (!candidate) return;
    if (navigator.vibrate) navigator.vibrate(60);
    setSales((prev) => prev.filter((s) => s.id !== candidate.id));
    if (candidate.id.startsWith("temp-")) return;
    const { error } = await supabase.from("sales").delete().eq("id", candidate.id);
    if (error) toast.error("Annulation impossible");
  };

  const onConcertCreated = async () => {
    await reloadConcerts();
  };

  if (!concert && loadingConcerts) {
    return (
      <div className="px-3 pt-3">
        <Skeleton className="w-full h-[76px] rounded-lg mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!concert && concerts.length === 0) {
    return (
      <div className="px-6 py-12 text-center space-y-4">
        <h2 className="font-display text-2xl">Aucun concert</h2>
        <p className="text-muted-foreground">Crée une fiche concert pour commencer à compter les ventes.</p>
        <button onClick={() => setShowNewConcert(true)} className="rounded-md bg-primary text-primary-foreground font-display tracking-wider px-6 py-3">
          Nouveau concert
        </button>
        {showNewConcert && (
          <NewConcertSheet bandId={bandId} onClose={() => setShowNewConcert(false)} onCreated={onConcertCreated} />
        )}
      </div>
    );
  }

  if (!concert) return null;

  return (
    <div className="px-3 pt-3">
      {/* Concert header */}
      <button onClick={() => setPicker(true)} className="w-full bg-card border border-border rounded-lg p-3 flex items-center justify-between mb-3">
        <div className="text-left">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Concert actif</div>
          <div className="font-display text-base text-primary">{concert.name}</div>
          <div className="text-xs text-muted-foreground">{new Date(concert.concert_date).toLocaleDateString("fr-BE")}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl">{formatEUR(totalCents)}</div>
          <div className="text-xs text-muted-foreground">{totalItems} vendu{totalItems > 1 ? "s" : ""}</div>
        </div>
      </button>

      {/* Big buttons grid */}
      <div className="grid grid-cols-2 gap-3">
        {loadingProducts
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)
          : products.map((p) => (
              <SaleButton key={p.id} product={p} count={counts.get(p.id) ?? 0} onAdd={() => addSale(p)} onRemove={() => removeSale(p.id)} />
            ))
        }
      </div>

      {picker && (
        <div className="fixed inset-0 bg-black/70 z-30 flex items-end" onClick={() => setPicker(false)}>
          <div className="w-full bg-card border-t border-border rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl">Choisir un concert</h2>
              <button onClick={() => { setPicker(false); setShowNewConcert(true); }} className="inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md">
                <Calendar className="h-4 w-4" /> Nouveau
              </button>
            </div>
            <ul className="space-y-1">
              {concerts.map((c) => (
                <li key={c.id}>
                  <button onClick={() => { setConcert(c); setPicker(false); }}
                    className={`w-full text-left px-3 py-3 rounded-md ${c.id === concert?.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs opacity-80">{new Date(c.concert_date).toLocaleDateString("fr-BE")}{c.is_active ? " • actif" : ""}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {showNewConcert && (
        <NewConcertSheet bandId={bandId} onClose={() => setShowNewConcert(false)} onCreated={onConcertCreated} />
      )}
    </div>
  );
}

function NewConcertSheet({ bandId, onClose, onCreated }: { bandId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("concerts").insert({
      band_id: bandId, name: name.trim(), concert_date: date, is_active: true,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    await onCreated();
    toast.success("Concert créé");
    onClose();
    return data;
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-end" onClick={onClose}>
      <div className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl">Nouveau concert</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex: Durbuy Rock)"
          className="w-full rounded-md bg-input border border-border px-3 py-3" autoFocus />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <button onClick={create} disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50">
          Créer
        </button>
      </div>
    </div>
  );
}

function SaleButton({ product, count, onAdd, onRemove }: { product: Product; count: number; onAdd: () => void; onRemove: () => void }) {
  const [flash, setFlash] = useState(false);

  const handleAdd = () => {
    onAdd();
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

  return (
    <div className="relative">
      <button
        onClick={handleAdd}
        data-flash={flash}
        className="tap-btn w-full aspect-square p-3"
      >
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground text-center">{product.name}</div>
        {product.variant && <div className="font-display text-3xl text-foreground mt-0.5">{product.variant}</div>}
        <div className="font-display text-5xl text-primary mt-auto leading-none">{count}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{formatEUR(product.price_cents)}</div>
        <Plus className="absolute top-2 right-2 h-4 w-4 text-muted-foreground" />
      </button>
      {count > 0 && (
        <button
          onClick={onRemove}
          aria-label="Annuler une vente"
          className="absolute bottom-2 left-2 w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center active:scale-90 transition"
        >
          <Minus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
