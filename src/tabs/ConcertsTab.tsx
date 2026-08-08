import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronLeft, Plus, Trash2, Lock, RotateCcw, Banknote, QrCode, Wallet, Package,
  Download,
} from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { PAYEES } from "../lib/payment";
import { deleteConcert, updateConcert } from "../lib/db";
import { offerFile, salesFileName, salesWorkbook } from "../lib/exportSales";
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

      {/* NewConcertModal se place déjà lui-même dans document.body : un second
          portail par-dessus n'ajouterait rien. */}
      {newOpen && <NewConcertModal onClose={() => setNewOpen(false)} onCreated={() => {}} />}
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
  const { families, variants, sales, settlements } = useStore();
  const [name, setName] = useState(concert.name);
  const [date, setDate] = useState(concert.concert_date);
  const [notes, setNotes] = useState(concert.notes ?? "");
  const [active, setActive] = useState(concert.is_active);
  const closed = concert.is_closed === true;

  useBackHandler(true, onBack);

  const mySales = useMemo(() => sales.filter((s) => s.concert_id === concert.id), [sales, concert.id]);
  const mySettlements = useMemo(
    () => settlements.filter((r) => r.concert_id === concert.id),
    [settlements, concert.id]
  );

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

  // Ce que la soirée a rapporté EN TOUT : le merch et le cachet, quel que soit
  // son mode de paiement. Le mot « totale » ne peut pas exclure le cachet.
  const fee = concert.fee_cents ?? 0;
  const recette = total + fee;

  // Supprimer une taille ne supprime pas ses ventes : celles-ci ne retombent
  // alors sur aucune ligne du détail, et l'argent vendu disparaissait de
  // l'écran tout en restant dans le total. On le remonte sur une ligne à part
  // plutôt que de le laisser s'évaporer.
  const orphanCents = total - grouped.reduce((s, r) => s + r.total, 0);

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
    if (!confirm("Supprimer ce concert, ses ventes et ses remises ?")) return;
    try {
      await deleteConcert(
        concert.id,
        mySales.map((s) => s.id),
        mySettlements.map((r) => r.id),
      );
      onDeleted();
    } catch (e) { toast.error((e as Error).message); }
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
          <div className="font-display text-[2.5rem] text-primary leading-none mt-1.5">{formatEUR(recette)}</div>
          <div className="text-xs text-muted-foreground mt-2">
            {formatEUR(total)} de merch
            {fee > 0 && <> · {formatEUR(fee)} de cachet</>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
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

      <button
        onClick={async () => {
          try {
            await offerFile(
              salesWorkbook(concert, mySales, families, variants, mySettlements),
              salesFileName(concert.name, concert.concert_date),
            );
          } catch (e) { toast.error((e as Error).message); }
        }}
        disabled={mySales.length === 0}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm active:bg-muted/40 transition disabled:opacity-40"
      >
        <Download className="h-4 w-4" /> Exporter les ventes
      </button>

      <FeeEditor concert={concert} />

      {/* Sales breakdown */}
      {grouped.length === 0 && orphanCents === 0 ? (
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

          {/* Ventes dont l'article n'existe plus. Sans cette ligne, elles
              comptaient dans le total sans apparaître nulle part. */}
          {orphanCents !== 0 && (
            <div className="card-surface rounded-2xl flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base text-muted-foreground truncate">
                  Articles supprimés
                </div>
                <div className="text-[11px] text-muted-foreground">
                  vendus, puis retirés du stock
                </div>
              </div>
              <div className="font-display text-lg">{formatEUR(orphanCents)}</div>
            </div>
          )}
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

/**
 * Saisie du cachet.
 *
 * Le mode de paiement n'est pas un détail cosmétique : un cachet en liquide
 * entre dans la boîte, un cachet viré reste chez le membre crédité jusqu'à ce
 * qu'il le rende. Se tromper ici fausse l'état de la caisse du montant du
 * cachet, c'est-à-dire beaucoup.
 */
function FeeEditor({ concert }: { concert: Concert }) {
  const cents = concert.fee_cents ?? 0;
  const method = concert.fee_method ?? "cash";
  const payee = concert.fee_payee ?? null;
  const [draft, setDraft] = useState((cents / 100 || "").toString());

  const save = async (patch: {
    fee_cents?: number; fee_method?: "cash" | "virement"; fee_payee?: string | null;
  }) => {
    try { await updateConcert(concert.id, patch); }
    catch (e) { toast.error((e as Error).message); }
  };

  const parseDraft = (raw: string) =>
    Math.max(0, Math.round(parseFloat(raw.replace(",", ".") || "0") * 100));

  // Ce que l'écran a de plus récent, lisible depuis un nettoyage d'effet.
  const latest = useRef({ draft, cents, method: concert.fee_method });
  useLayoutEffect(() => {
    latest.current = { draft, cents, method: concert.fee_method };
  });

  // Enregistrement au fil de la frappe, une demi-seconde après la dernière
  // touche : le montant part sans attendre que le champ perde le focus.
  useEffect(() => {
    const next = parseDraft(draft);
    if (next === cents) return;
    const id = setTimeout(() => {
      // Passer de « rien » à un montant sans mode choisi : le liquide est le
      // cas courant, on l'inscrit explicitement plutôt que de le sous-entendre.
      updateConcert(concert.id, {
        fee_cents: next,
        fee_method: concert.fee_method ?? "cash",
        fee_at: Date.now(),
      }).catch((e) => toast.error((e as Error).message));
    }, 500);
    return () => clearTimeout(id);
  }, [draft, cents, concert.id, concert.fee_method]);

  // Dernier filet au démontage. Quitter l'écran alors que le champ a encore le
  // focus ne déclenche AUCUN `blur` — le navigateur retire simplement
  // l'élément. Sans ça, un cachet tapé puis suivi d'un retour immédiat était
  // perdu en silence, et rien n'arrivait dans la caisse.
  useEffect(() => {
    const id = concert.id;
    return () => {
      const cur = latest.current;
      const next = parseDraft(cur.draft);
      if (next === cur.cents) return;
      updateConcert(id, {
        fee_cents: next, fee_method: cur.method ?? "cash", fee_at: Date.now(),
      }).catch(() => {
        /* hors ligne : Firestore rejouera l'écriture au retour du réseau */
      });
    };
  }, [concert.id]);

  return (
    <div className="card-surface rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Cachet</div>
      </div>

      <label className="rounded-xl bg-muted px-3 py-2 block">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant (€)</div>
        <input
          type="number" step="10" min={0} inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="0"
          className="w-full bg-transparent text-2xl font-display outline-none"
        />
      </label>

      {cents > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => save({ fee_method: "cash", fee_payee: null })}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                method === "cash" ? "bg-ok text-white" : "bg-muted/60 border border-border text-muted-foreground"
              }`}
            >
              <Banknote className="h-4 w-4" /> Liquide
            </button>
            <button
              onClick={() => save({ fee_method: "virement" })}
              className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
                method === "virement" ? "btn-primary" : "bg-muted/60 border border-border text-muted-foreground"
              }`}
            >
              <QrCode className="h-4 w-4" /> Virement
            </button>
          </div>

          {method === "virement" && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Viré sur le compte de
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PAYEES.map((p) => (
                  <button
                    key={p}
                    onClick={() => save({ fee_payee: p })}
                    className={`rounded-lg py-2 text-[13px] font-semibold transition ${
                      payee === p ? "btn-primary" : "bg-muted/60 border border-border text-muted-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {!payee && (
                <p className="text-[11px] text-warn mt-1.5">
                  Choisis un membre, sinon on ne saura pas qui doit le remettre.
                </p>
              )}
            </div>
          )}

        </>
      )}
    </div>
  );
}
