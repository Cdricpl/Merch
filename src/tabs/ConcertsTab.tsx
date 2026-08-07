import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { ChevronLeft, Plus, Trash2, Lock, RotateCcw, Banknote, QrCode } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { paymentLabel } from "../lib/payment";
import { deleteConcert, updateConcert } from "../lib/db";
import { useBackHandler } from "../lib/useBackHandler";
import { saleTotalCents, type Concert } from "../lib/types";
import { NewConcertModal } from "../components/NewConcertModal";
import { ConcertCard } from "../components/ConcertCard";

export function ConcertsTab() {
  const { concerts, sales } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const totalsByConcert = useMemo(() => {
    const m = new Map<string, { items: number; cents: number }>();
    for (const s of sales) {
      const cur = m.get(s.concert_id) ?? { items: 0, cents: 0 };
      cur.items += s.quantity;
      cur.cents += saleTotalCents(s);
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
    <div className="px-4 pt-1 pb-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[22px]">Concerts</h1>
        <button
          onClick={() => setNewOpen(true)}
          aria-label="Nouveau concert"
          className="w-9 h-9 rounded-full btn-primary flex items-center justify-center active:scale-90 transition"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {concerts.length === 0 && (
        <p className="text-center text-muted-foreground py-12 text-sm">Aucun concert encore.</p>
      )}

      <div className="space-y-3">
        {concerts.map((c) => {
          const t = totalsByConcert.get(c.id) ?? { items: 0, cents: 0 };
          return (
            <ConcertCard
              key={c.id}
              concert={c}
              totalCents={t.cents}
              totalItems={t.items}
              onOpen={() => setOpenId(c.id)}
            />
          );
        })}
      </div>

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
  const closed = concert.is_closed === true;

  useBackHandler(true, onBack);

  const mySales = useMemo(() => sales.filter((s) => s.concert_id === concert.id), [sales, concert.id]);

  const byVariant = useMemo(() => {
    const m = new Map<string, { qty: number; cents: number }>();
    for (const s of mySales) {
      const cur = m.get(s.variant_id) ?? { qty: 0, cents: 0 };
      cur.qty += s.quantity;
      cur.cents += saleTotalCents(s);
      m.set(s.variant_id, cur);
    }
    return m;
  }, [mySales]);

  const grouped = useMemo(() => {
    const rows: Array<{
      family: (typeof families)[0];
      entries: Array<{ label: string | null; qty: number; cents: number }>;
      total: number;
    }> = [];
    for (const f of families) {
      const entries = variants
        .filter((v) => v.family_id === f.id)
        .map((v) => {
          const stat = byVariant.get(v.id);
          return stat ? { label: v.label, qty: stat.qty, cents: stat.cents } : null;
        })
        .filter((x): x is { label: string | null; qty: number; cents: number } => x !== null && x.qty > 0);
      if (entries.length > 0) {
        rows.push({ family: f, entries, total: entries.reduce((s, e) => s + e.cents, 0) });
      }
    }
    return rows;
  }, [families, variants, byVariant]);

  const total = mySales.reduce((s, x) => s + saleTotalCents(x), 0);
  const totalItems = mySales.reduce((s, x) => s + x.quantity, 0);
  const totalDiscount = mySales.reduce((s, x) => s + (x.discount_cents ?? 0), 0);

  // Qui détient quoi : le cash est dans la boîte, chaque QR est arrivé sur le
  // compte d'un membre. C'est ce tableau qui sert à répartir en fin de soirée.
  const byPayment = useMemo(() => {
    const rows = new Map<string, { label: string; cents: number; items: number }>();
    for (const s of mySales) {
      const key = s.payment_method === "qr" ? `qr:${s.payment_payee ?? ""}` : (s.payment_method ?? "unknown");
      const cur = rows.get(key) ?? {
        label: paymentLabel(s.payment_method, s.payment_payee),
        cents: 0,
        items: 0,
      };
      cur.cents += saleTotalCents(s);
      cur.items += s.quantity;
      rows.set(key, cur);
    }
    // Cash d'abord, puis les QR par montant décroissant, « non renseigné » en fin.
    return [...rows.entries()]
      .sort(([ka, a], [kb, b]) => {
        const rank = (k: string) => (k === "cash" ? 0 : k === "unknown" ? 2 : 1);
        return rank(ka) - rank(kb) || b.cents - a.cents;
      })
      .map(([key, v]) => ({ key, ...v }));
  }, [mySales]);

  const save = async () => {
    try {
      await updateConcert(concert.id, { name, concert_date: date, notes: notes || null, is_active: active });
      toast.success("Enregistré");
    } catch (e) { toast.error((e as Error).message); }
  };

  const close = async () => {
    if (!confirm("Clôturer ce concert ?")) return;
    try {
      await updateConcert(concert.id, { is_active: false, is_closed: true });
      setActive(false);
      toast.success("Concert clôturé");
    } catch (e) { toast.error((e as Error).message); }
  };

  const reopen = async () => {
    try {
      await updateConcert(concert.id, { is_closed: false });
      toast.success("Concert rouvert");
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async () => {
    if (!confirm("Supprimer ce concert et toutes ses ventes ?")) return;
    try { await deleteConcert(concert.id, mySales.map((s) => s.id)); onDeleted(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="px-4 pt-1 pb-6 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} aria-label="Retour" className="inline-flex items-center gap-2 -ml-1">
          <ChevronLeft className="h-5 w-5 text-foreground" />
          <span className="font-display text-[22px]">Concerts</span>
        </button>
        {closed && (
          <span className="text-[10px] uppercase tracking-widest bg-muted text-muted-foreground px-2 py-1 rounded">
            Clôturé
          </span>
        )}
      </div>

      {/* Hero recap */}
      <div className="card-surface rounded-2xl p-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Recette totale</div>
          <div className="font-display text-[2.5rem] text-primary leading-none mt-1.5">{formatEUR(total)}</div>
          <div className="text-xs text-muted-foreground mt-2">
            {totalItems} article{totalItems > 1 ? "s" : ""} vendu{totalItems > 1 ? "s" : ""}
            {totalDiscount > 0 && (
              <> · <span className="text-emerald-500">{formatEUR(totalDiscount)} de remises</span></>
            )}
          </div>
        </div>
      </div>

      {/* Edit fields */}
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl bg-input border border-border px-3 py-3 font-display text-lg"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl bg-input border border-border px-3 py-3"
        />
        <label className="flex items-center gap-2 text-sm px-1">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            disabled={closed}
            className="h-5 w-5 accent-primary"
          />
          Concert actif (apparaît par défaut dans Ventes)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes…"
          rows={2}
          className="w-full rounded-xl bg-input border border-border px-3 py-3"
        />
      </div>

      {/* Répartition de l'encaissement */}
      {byPayment.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Qui a encaissé
          </div>
          <div className="card-surface rounded-2xl divide-y divide-border">
            {byPayment.map((p) => (
              <div key={p.key} className="flex items-center gap-3 px-3 py-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    p.key === "cash"
                      ? "bg-emerald-600/20 text-emerald-500"
                      : p.key === "unknown"
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/20 text-primary"
                  }`}
                >
                  {p.key === "cash" ? <Banknote className="h-4 w-4" /> : <QrCode className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{p.label}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.items} article{p.items > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="font-display text-lg shrink-0">{formatEUR(p.cents)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales breakdown */}
      {grouped.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-6">Aucune vente pour ce concert.</div>
      ) : (
        <div className="space-y-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Détail des ventes
          </div>
          {grouped.map(({ family, entries, total }) => (
            <div key={family.id} className="card-surface rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 p-3 border-b border-border/60">
                <div className="w-10 h-10 rounded-md bg-muted overflow-hidden shrink-0">
                  {family.image && <img src={family.image} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-base text-primary truncate">{family.name}</div>
                  <div className="text-[11px] text-muted-foreground">{formatEUR(family.price_cents)} pièce</div>
                </div>
                <div className="font-display text-lg">{formatEUR(total)}</div>
              </div>
              <div className="divide-y divide-border/40">
                {entries.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-10 font-display text-base">{e.label ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">×{e.qty}</span>
                    </div>
                    <div className="text-sm">{formatEUR(e.cents)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={save}
          className="flex-1 rounded-xl btn-primary font-display tracking-wider py-3"
        >
          Enregistrer
        </button>
        <button
          onClick={remove}
          aria-label="Supprimer ce concert"
          className="rounded-xl border border-border p-3 text-destructive"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {closed ? (
        <button
          onClick={reopen}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4" /> Rouvrir ce concert
        </button>
      ) : (
        <button
          onClick={close}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm"
        >
          <Lock className="h-4 w-4" /> Clôturer ce concert
        </button>
      )}
    </div>
  );
}
