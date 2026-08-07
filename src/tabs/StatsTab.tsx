import { useMemo } from "react";
import { Banknote, QrCode, TrendingUp } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { paymentLabel } from "../lib/payment";
import { parseName } from "../lib/category";
import { saleTotalCents } from "../lib/types";

/**
 * Vue d'ensemble, toutes dates confondues.
 *
 * La répartition par encaisseur figure aussi dans le récap d'un concert — c'est
 * là qu'elle sert à répartir le soir même. Ici, elle donne le cumul de la
 * tournée.
 */
export function StatsTab() {
  const { families, variants, sales } = useStore();

  const totals = useMemo(() => {
    let cents = 0, items = 0, discount = 0, cash = 0, qr = 0, unknown = 0;
    for (const s of sales) {
      const amount = saleTotalCents(s);
      cents += amount;
      items += s.quantity;
      discount += s.discount_cents ?? 0;
      if (s.payment_method === "cash") cash += amount;
      else if (s.payment_method === "qr") qr += amount;
      else unknown += amount;
    }
    return { cents, items, discount, cash, qr, unknown };
  }, [sales]);

  const byPayee = useMemo(() => {
    const m = new Map<string, { label: string; cents: number }>();
    for (const s of sales) {
      const key = s.payment_method === "qr" ? `qr:${s.payment_payee ?? ""}` : (s.payment_method ?? "unknown");
      const cur = m.get(key) ?? { label: paymentLabel(s.payment_method, s.payment_payee), cents: 0 };
      cur.cents += saleTotalCents(s);
      m.set(key, cur);
    }
    return [...m.entries()]
      .sort(([ka, a], [kb, b]) => {
        const rank = (k: string) => (k === "cash" ? 0 : k === "unknown" ? 2 : 1);
        return rank(ka) - rank(kb) || b.cents - a.cents;
      })
      .map(([key, v]) => ({ key, ...v }));
  }, [sales]);

  const topFamilies = useMemo(() => {
    const familyOf = new Map(variants.map((v) => [v.id, v.family_id]));
    const m = new Map<string, { qty: number; cents: number }>();
    for (const s of sales) {
      const fid = familyOf.get(s.variant_id);
      if (!fid) continue;
      const cur = m.get(fid) ?? { qty: 0, cents: 0 };
      cur.qty += s.quantity;
      cur.cents += saleTotalCents(s);
      m.set(fid, cur);
    }
    const rows = families
      .map((f) => ({ family: f, ...(m.get(f.id) ?? { qty: 0, cents: 0 }) }))
      .filter((r) => r.qty > 0)
      .sort((a, b) => b.qty - a.qty);
    const max = rows[0]?.qty ?? 1;
    return rows.map((r) => ({ ...r, share: r.qty / max }));
  }, [families, variants, sales]);

  // Ce qu'il reste à vendre, au prix catalogue.
  const stockValue = useMemo(() => {
    const priceOf = new Map(families.map((f) => [f.id, f.price_cents]));
    let cents = 0, units = 0;
    for (const v of variants) {
      const p = priceOf.get(v.family_id);
      if (p === undefined || v.stock <= 0) continue;
      cents += p * v.stock;
      units += v.stock;
    }
    return { cents, units };
  }, [families, variants]);

  return (
    <div className="px-4 pt-1 pb-6 space-y-4">
      <h1 className="font-display text-[22px]">Stats</h1>

      <div className="card-surface rounded-2xl p-4">
        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Recette — toutes dates
        </div>
        <div className="font-display text-[2.5rem] leading-none text-primary mt-1.5">
          {formatEUR(totals.cents)}
        </div>
        <div className="text-[13px] text-muted-foreground mt-2">
          {totals.items} article{totals.items > 1 ? "s" : ""} vendu{totals.items > 1 ? "s" : ""}
          {totals.discount > 0 && <> · {formatEUR(totals.discount)} de remises</>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-surface rounded-2xl p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <Banknote className="h-3.5 w-3.5" /> Cash
          </div>
          <div className="font-display text-[21px] leading-none mt-1.5">{formatEUR(totals.cash)}</div>
        </div>
        <div className="card-surface rounded-2xl p-3.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <QrCode className="h-3.5 w-3.5" /> QR
          </div>
          <div className="font-display text-[21px] leading-none mt-1.5">{formatEUR(totals.qr)}</div>
        </div>
      </div>

      {byPayee.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Qui a encaissé</h2>
          <div className="card-surface rounded-2xl divide-y divide-border">
            {byPayee.map((p) => (
              <div key={p.key} className="flex items-center gap-3 px-3.5 py-3">
                {p.key === "cash" ? (
                  <Banknote className="h-4 w-4 text-ok shrink-0" />
                ) : (
                  <QrCode className={`h-4 w-4 shrink-0 ${p.key === "unknown" ? "text-muted-foreground" : "text-primary"}`} />
                )}
                <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{p.label}</span>
                <span className="font-display text-[17px]">{formatEUR(p.cents)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {topFamilies.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Meilleures ventes</h2>
          <div className="card-surface rounded-2xl divide-y divide-border">
            {topFamilies.map(({ family, qty, cents, share }) => {
              const { display } = parseName(family.name);
              return (
                <div key={family.id} className="px-3.5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex-1 min-w-0 text-[14px] font-medium truncate">{display}</span>
                    <span className="text-[12px] text-muted-foreground shrink-0">×{qty}</span>
                    <span className="font-display text-[16px] shrink-0 w-[72px] text-right">{formatEUR(cents)}</span>
                  </div>
                  <div className="gauge mt-2">
                    <span style={{ width: `${Math.max(4, share * 100)}%`, background: "var(--primary)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="card-surface rounded-2xl p-3.5 flex items-center gap-3">
        <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Stock restant</div>
          <div className="text-[12px] text-muted-foreground mt-0.5">
            {stockValue.units} pièce{stockValue.units > 1 ? "s" : ""} au prix catalogue
          </div>
        </div>
        <div className="font-display text-[21px] shrink-0">{formatEUR(stockValue.cents)}</div>
      </div>

      {sales.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">Aucune vente enregistrée.</p>
      )}
    </div>
  );
}
