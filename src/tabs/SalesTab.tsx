import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Plus, X, Calendar, Sparkles } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { recordSale, undoSale, seedInitialStock } from "../lib/db";
import type { Family, Variant, Concert, Sale } from "../lib/types";
import { NewConcertModal } from "../components/NewConcertModal";

export function SalesTab() {
  const { families, variants, concerts, sales, loading } = useStore();
  const [pickerFamily, setPickerFamily] = useState<Family | null>(null);
  const [concertPicker, setConcertPicker] = useState(false);
  const [newConcertOpen, setNewConcertOpen] = useState(false);
  const [activeConcertId, setActiveConcertId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const concert: Concert | null = useMemo(() => {
    if (concerts.length === 0) return null;
    if (activeConcertId) {
      return concerts.find((c) => c.id === activeConcertId) ?? null;
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

  const grouped = useMemo(() => {
    return families.map((f) => {
      const items = variants.filter((v) => v.family_id === f.id);
      const stock = items.reduce((s, x) => s + x.stock, 0);
      const sold = items.reduce((total, v) => {
        return total + salesThisConcert.filter((s) => s.variant_id === v.id).reduce((s, x) => s + x.quantity, 0);
      }, 0);
      return { family: f, items, stock, sold };
    });
  }, [families, variants, salesThisConcert]);

  const doAddSale = async (family: Family, variant: Variant) => {
    if (!concert) return;
    if (concert.is_closed) {
      toast.error("Concert clôturé — impossible d'ajouter des ventes");
      return;
    }
    if (navigator.vibrate) navigator.vibrate(20);
    try {
      await recordSale({ concertId: concert.id, variantId: variant.id, priceCents: family.price_cents });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const doRemoveLastSale = async (variant: Variant) => {
    if (!concert) return;
    const last = [...salesThisConcert]
      .filter((s) => s.variant_id === variant.id)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
    if (!last) return;
    if (navigator.vibrate) navigator.vibrate(50);
    try {
      await undoSale(last.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

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
          Charge ton stock initial (les données de la note du 25/05/2026)
          ou ajoute manuellement dans l'onglet Stock.
        </p>
        <button
          onClick={doSeed}
          disabled={seeding}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground font-display tracking-wider px-6 py-3 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
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
            ? "Tous tes concerts sont clôturés. Crée-en un nouveau pour compter des ventes, ou rouvre un ancien depuis l'onglet Concerts."
            : "Crée une fiche concert pour commencer à compter les ventes."}
        </p>
        <button
          onClick={() => setNewConcertOpen(true)}
          className="rounded-md bg-primary text-primary-foreground font-display tracking-wider px-6 py-3"
        >
          Nouveau concert
        </button>
        {newConcertOpen && (
          <NewConcertModal onClose={() => setNewConcertOpen(false)} onCreated={(id) => setActiveConcertId(id)} />
        )}
      </div>
    );
  }

  return (
    <div className="px-3 pt-3">
      <button
        onClick={() => setConcertPicker(true)}
        className="w-full bg-card border border-border rounded-lg p-3 flex items-center justify-between mb-3"
      >
        <div className="text-left">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Concert actif</div>
          <div className="font-display text-base text-primary">{concert.name}</div>
          <div className="text-xs text-muted-foreground">{new Date(concert.concert_date).toLocaleDateString("fr-BE")}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl">{formatEUR(totalCents)}</div>
          <div className="text-xs text-muted-foreground">
            {totalItems} vendu{totalItems > 1 ? "s" : ""}
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3">
        {grouped.map(({ family, items, stock, sold }) => {
          const single = items.length === 1 && !items[0].label;
          const lowStock = stock <= family.low_alert;
          return (
            <button
              key={family.id}
              onClick={() => {
                if (single) doAddSale(family, items[0]);
                else setPickerFamily(family);
              }}
              disabled={stock === 0}
              className="tap-btn w-full aspect-square p-2 flex flex-col disabled:opacity-40"
            >
              <div className="flex items-start justify-between w-full">
                <div className="w-9 h-9 rounded-md bg-muted overflow-hidden flex items-center justify-center shrink-0">
                  {family.image ? (
                    <img src={family.image} alt="" className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`text-xs font-bold leading-none ${lowStock ? "text-destructive" : "text-muted-foreground"}`}>
                    {stock}
                  </span>
                  {items.length > 1 && (
                    <span className="text-[9px] text-muted-foreground leading-none">
                      {items.length} tailles
                    </span>
                  )}
                  {single && <Plus className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight line-clamp-2">
                  {family.name}
                </div>
                <div className="font-display text-4xl text-primary leading-none mt-1">{sold}</div>
              </div>
              <div className="text-[10px] text-muted-foreground text-center w-full">
                {formatEUR(family.price_cents)}
              </div>
            </button>
          );
        })}
      </div>

      {pickerFamily &&
        createPortal(
          <VariantPickerModal
            family={pickerFamily}
            variants={variants.filter((v) => v.family_id === pickerFamily.id)}
            sales={salesThisConcert}
            onAdd={(v) => doAddSale(pickerFamily, v)}
            onRemove={(v) => doRemoveLastSale(v)}
            onClose={() => setPickerFamily(null)}
          />,
          document.body
        )}

      {concertPicker &&
        createPortal(
          <ConcertPickerModal
            concerts={concerts}
            currentId={concert.id}
            onPick={(id) => {
              setActiveConcertId(id);
              setConcertPicker(false);
            }}
            onNew={() => {
              setConcertPicker(false);
              setNewConcertOpen(true);
            }}
            onClose={() => setConcertPicker(false)}
          />,
          document.body
        )}

      {newConcertOpen && (
        <NewConcertModal onClose={() => setNewConcertOpen(false)} onCreated={(id) => setActiveConcertId(id)} />
      )}
    </div>
  );
}

function VariantPickerModal({
  family,
  variants,
  sales,
  onAdd,
  onRemove,
  onClose,
}: {
  family: Family;
  variants: Variant[];
  sales: Sale[];
  onAdd: (v: Variant) => void;
  onRemove: (v: Variant) => void;
  onClose: () => void;
}) {
  const countFor = (id: string) =>
    sales.filter((s) => s.variant_id === id).reduce((s, x) => s + x.quantity, 0);

  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-xl text-primary">{family.name}</h2>
            <p className="text-xs text-muted-foreground">{formatEUR(family.price_cents)} pièce</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="p-2 -mr-2 text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <ul className="space-y-2">
          {variants.map((v) => {
            const count = countFor(v.id);
            const lowStock = v.stock <= family.low_alert;
            return (
              <li key={v.id} className="flex items-center gap-3 bg-muted rounded-lg p-2">
                <div className="flex-1 min-w-0">
                  <div className="font-display text-2xl">{v.label ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    stock <span className={lowStock ? "text-destructive font-semibold" : ""}>{v.stock}</span>
                    {count > 0 && <> · vendus {count}</>}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(v)}
                  disabled={count === 0}
                  aria-label={`Annuler une vente ${v.label ?? ""}`}
                  className="w-11 h-11 rounded-full border border-border flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                >
                  <span className="text-xl leading-none">−</span>
                </button>
                <button
                  onClick={() => onAdd(v)}
                  disabled={v.stock <= 0}
                  aria-label={`Vendre 1 ${v.label ?? ""}`}
                  className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition disabled:opacity-30"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ConcertPickerModal({
  concerts,
  currentId,
  onPick,
  onNew,
  onClose,
}: {
  concerts: Concert[];
  currentId: string;
  onPick: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-end" onClick={onClose}>
      <div
        className="w-full bg-card border-t border-border rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Choisir un concert</h2>
          <button
            onClick={onNew}
            className="inline-flex items-center gap-1 text-sm bg-primary text-primary-foreground px-3 py-2 rounded-md"
          >
            <Calendar className="h-4 w-4" /> Nouveau
          </button>
        </div>
        <ul className="space-y-1">
          {concerts.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onPick(c.id)}
                className={`w-full text-left px-3 py-3 rounded-md ${
                  c.id === currentId ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{c.name}</div>
                  {c.is_closed && (
                    <span className="text-[9px] uppercase tracking-wider bg-background/40 px-1.5 py-0.5 rounded">
                      Clôturé
                    </span>
                  )}
                </div>
                <div className="text-xs opacity-80">
                  {new Date(c.concert_date).toLocaleDateString("fr-BE")}
                  {c.is_active && !c.is_closed ? " · actif" : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
