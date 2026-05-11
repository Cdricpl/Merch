import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

type Concert = { id: string; name: string; concert_date: string; notes: string | null; is_active: boolean };
type Product = { id: string; name: string; variant: string | null };
type Sale = { product_id: string; quantity: number; unit_price_cents: number };

export function ConcertsTab({ bandId }: { bandId: string }) {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [totals, setTotals] = useState<Record<string, { items: number; cents: number }>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    const { data: cs } = await supabase.from("concerts").select("*").eq("band_id", bandId)
      .order("concert_date", { ascending: false }).order("created_at", { ascending: false });
    const list = (cs ?? []) as Concert[];
    setConcerts(list);

    const { data: sales } = await supabase.from("sales").select("concert_id, quantity, unit_price_cents").eq("band_id", bandId);
    const map: Record<string, { items: number; cents: number }> = {};
    (sales ?? []).forEach((s: { concert_id: string; quantity: number; unit_price_cents: number }) => {
      const cur = map[s.concert_id] ?? { items: 0, cents: 0 };
      cur.items += s.quantity;
      cur.cents += s.quantity * s.unit_price_cents;
      map[s.concert_id] = cur;
    });
    setTotals(map);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [bandId]);

  if (openId) {
    const c = concerts.find((x) => x.id === openId);
    if (c) return <ConcertDetail concert={c} bandId={bandId} onBack={() => { setOpenId(null); load(); }} onDeleted={() => { setOpenId(null); load(); }} />;
  }

  return (
    <div className="px-4 pt-4 space-y-2">
      <button onClick={() => setShowNew(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3">
        <Plus className="h-4 w-4" /> Nouveau concert
      </button>

      {concerts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucun concert encore.</p>
      )}

      {concerts.map((c) => {
        const t = totals[c.id] ?? { items: 0, cents: 0 };
        return (
          <button key={c.id} onClick={() => setOpenId(c.id)} className="w-full bg-card border border-border rounded-lg p-3 flex items-center justify-between text-left">
            <div className="min-w-0">
              <div className="font-display text-base text-primary truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground">{new Date(c.concert_date).toLocaleDateString("fr-BE")}{c.is_active ? " • actif" : ""}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl">{formatEUR(t.cents)}</div>
              <div className="text-xs text-muted-foreground">{t.items} vendu{t.items > 1 ? "s" : ""}</div>
            </div>
          </button>
        );
      })}

      {showNew && <NewConcertSheet bandId={bandId} onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}

function ConcertDetail({ concert, bandId, onBack, onDeleted }: { concert: Concert; bandId: string; onBack: () => void; onDeleted: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [name, setName] = useState(concert.name);
  const [date, setDate] = useState(concert.concert_date);
  const [notes, setNotes] = useState(concert.notes ?? "");
  const [active, setActive] = useState(concert.is_active);

  useEffect(() => {
    supabase.from("products").select("id, name, variant").eq("band_id", bandId).order("sort_order")
      .then(({ data }) => setProducts((data ?? []) as Product[]));
    supabase.from("sales").select("product_id, quantity, unit_price_cents").eq("concert_id", concert.id)
      .then(({ data }) => setSales((data ?? []) as Sale[]));
  }, [bandId, concert.id]);

  const save = async () => {
    const { error } = await supabase.from("concerts")
      .update({ name, concert_date: date, notes: notes || null, is_active: active })
      .eq("id", concert.id);
    if (error) return toast.error(error.message);
    toast.success("Enregistré");
  };

  const remove = async () => {
    if (!confirm("Supprimer ce concert et toutes ses ventes ?")) return;
    const { error } = await supabase.from("concerts").delete().eq("id", concert.id);
    if (error) return toast.error(error.message);
    onDeleted();
  };

  const byProduct = new Map<string, { qty: number; cents: number }>();
  sales.forEach((s) => {
    const cur = byProduct.get(s.product_id) ?? { qty: 0, cents: 0 };
    cur.qty += s.quantity;
    cur.cents += s.quantity * s.unit_price_cents;
    byProduct.set(s.product_id, cur);
  });
  const total = sales.reduce((sum, s) => sum + s.quantity * s.unit_price_cents, 0);

  return (
    <div className="px-4 pt-4 space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Retour
      </button>

      <div className="space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md bg-input border border-border px-3 py-3 font-display text-lg" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-primary" />
          Concert actif (apparaît dans Ventes)
        </label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" rows={3}
          className="w-full rounded-md bg-input border border-border px-3 py-3" />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Recette totale</div>
        <div className="font-display text-4xl text-primary">{formatEUR(total)}</div>
      </div>

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {products.map((p) => {
          const stat = byProduct.get(p.id);
          if (!stat || stat.qty === 0) return null;
          return (
            <div key={p.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium">{p.name}{p.variant && <span className="text-primary"> — {p.variant}</span>}</div>
                <div className="text-xs text-muted-foreground">×{stat.qty}</div>
              </div>
              <div className="font-display">{formatEUR(stat.cents)}</div>
            </div>
          );
        })}
        {sales.length === 0 && <div className="p-4 text-sm text-muted-foreground text-center">Aucune vente.</div>}
      </div>

      <div className="flex gap-2">
        <button onClick={save} className="flex-1 rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3">Enregistrer</button>
        <button onClick={remove} className="rounded-md border border-border p-3 text-destructive">
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
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
    const { error } = await supabase.from("concerts").insert({
      band_id: bandId, name: name.trim(), concert_date: date, is_active: true,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    onCreated();
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-30 flex items-end" onClick={onClose}>
      <div className="w-full bg-card border-t border-border rounded-t-2xl p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl">Nouveau concert</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex: Durbuy Rock)"
          className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md bg-input border border-border px-3 py-3" />
        <button onClick={create} disabled={busy} className="w-full rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3 disabled:opacity-50">
          Créer
        </button>
      </div>
    </div>
  );
}
