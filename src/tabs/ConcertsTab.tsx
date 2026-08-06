import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { deleteConcert, updateConcert } from "../lib/db";
import type { Concert } from "../lib/types";
import { NewConcertModal } from "../components/NewConcertModal";

export function ConcertsTab() {
  const { concerts, sales } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const totalsByConcert = useMemo(() => {
    const m = new Map<string, { items: number; cents: number }>();
    for (const s of sales) {
      const cur = m.get(s.concert_id) ?? { items: 0, cents: 0 };
      cur.items += s.quantity;
      cur.cents += s.quantity * s.unit_price_cents;
      m.set(s.concert_id, cur);
    }
    return m;
  }, [sales]);

  if (openId) {
    const c = concerts.find((x) => x.id === openId);
    if (c) {
      return (
        <ConcertDetail
          concert={c}
          onBack={() => setOpenId(null)}
          onDeleted={() => setOpenId(null)}
        />
      );
    }
  }

  return (
    <div className="px-4 pt-4 space-y-2">
      <button
        onClick={() => setNewOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3"
      >
        <Plus className="h-4 w-4" /> Nouveau concert
      </button>

      {concerts.length === 0 && (
        <p className="text-center text-muted-foreground py-12">Aucun concert encore.</p>
      )}

      {concerts.map((c) => {
        const t = totalsByConcert.get(c.id) ?? { items: 0, cents: 0 };
        return (
          <button
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className="w-full bg-card border border-border rounded-lg p-3 flex items-center justify-between text-left"
          >
            <div className="min-w-0">
              <div className="font-display text-base text-primary truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(c.concert_date).toLocaleDateString("fr-BE")}
                {c.is_active ? " · actif" : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-xl">{formatEUR(t.cents)}</div>
              <div className="text-xs text-muted-foreground">
                {t.items} vendu{t.items > 1 ? "s" : ""}
              </div>
            </div>
          </button>
        );
      })}

      {newOpen &&
        createPortal(
          <NewConcertModal onClose={() => setNewOpen(false)} onCreated={() => {}} />,
          document.body
        )}
    </div>
  );
}

function ConcertDetail({
  concert,
  onBack,
  onDeleted,
}: {
  concert: Concert;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const { families, variants, sales } = useStore();
  const [name, setName] = useState(concert.name);
  const [date, setDate] = useState(concert.concert_date);
  const [notes, setNotes] = useState(concert.notes ?? "");
  const [active, setActive] = useState(concert.is_active);

  const mySales = useMemo(() => sales.filter((s) => s.concert_id === concert.id), [sales, concert.id]);

  const byVariant = useMemo(() => {
    const m = new Map<string, { qty: number; cents: number }>();
    for (const s of mySales) {
      const cur = m.get(s.variant_id) ?? { qty: 0, cents: 0 };
      cur.qty += s.quantity;
      cur.cents += s.quantity * s.unit_price_cents;
      m.set(s.variant_id, cur);
    }
    return m;
  }, [mySales]);

  const grouped = useMemo(() => {
    const rows: Array<{
      family: (typeof families)[0];
      entries: Array<{ label: string | null; qty: number; cents: number }>;
    }> = [];
    for (const f of families) {
      const entries = variants
        .filter((v) => v.family_id === f.id)
        .map((v) => {
          const stat = byVariant.get(v.id);
          return stat ? { label: v.label, qty: stat.qty, cents: stat.cents } : null;
        })
        .filter((x): x is { label: string | null; qty: number; cents: number } => x !== null && x.qty > 0);
      if (entries.length > 0) rows.push({ family: f, entries });
    }
    return rows;
  }, [families, variants, byVariant]);

  const total = mySales.reduce((s, x) => s + x.quantity * x.unit_price_cents, 0);
  const totalItems = mySales.reduce((s, x) => s + x.quantity, 0);

  const save = async () => {
    try {
      await updateConcert(concert.id, { name, concert_date: date, notes: notes || null, is_active: active });
      toast.success("Enregistré");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async () => {
    if (!confirm("Supprimer ce concert et toutes ses ventes ?")) return;
    try {
      await deleteConcert(concert.id, mySales.map((s) => s.id));
      onDeleted();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="px-4 pt-4 space-y-4">
      <button onClick={onBack} aria-label="Retour" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="h-4 w-4" /> Retour
      </button>

      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md bg-input border border-border px-3 py-3 font-display text-lg"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md bg-input border border-border px-3 py-3"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-5 w-5 accent-primary"
          />
          Concert actif (apparaît par défaut dans Ventes)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes…"
          rows={2}
          className="w-full rounded-md bg-input border border-border px-3 py-3"
        />
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Recette totale</div>
        <div className="font-display text-4xl text-primary">{formatEUR(total)}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {totalItems} article{totalItems > 1 ? "s" : ""} vendu{totalItems > 1 ? "s" : ""}
        </div>
      </div>

      {grouped.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-6">Aucune vente pour ce concert.</div>
      )}

      {grouped.map(({ family, entries }) => (
        <div key={family.id} className="bg-card border border-border rounded-lg divide-y divide-border">
          <div className="p-3">
            <div className="font-display text-base text-primary">{family.name}</div>
            <div className="text-[11px] text-muted-foreground">{formatEUR(family.price_cents)} pièce</div>
          </div>
          {entries.map((e, i) => (
            <div key={i} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <span className="w-14 font-display text-lg">{e.label ?? "—"}</span>
                <span className="text-xs text-muted-foreground">×{e.qty}</span>
              </div>
              <div className="font-display">{formatEUR(e.cents)}</div>
            </div>
          ))}
        </div>
      ))}

      <div className="flex gap-2">
        <button onClick={save} className="flex-1 rounded-md bg-primary text-primary-foreground font-display tracking-wider py-3">
          Enregistrer
        </button>
        <button onClick={remove} aria-label="Supprimer ce concert" className="rounded-md border border-border p-3 text-destructive">
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
