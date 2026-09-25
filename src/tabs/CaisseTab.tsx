import { useMemo } from "react";
import { toast } from "sonner";
import { Check, Undo2 } from "lucide-react";
import { useStore } from "../lib/store";
import { formatEUR } from "../lib/format";
import { payeeDebts, settlementPlan, totalOwed } from "../lib/caisse";
import { createSettlements, deleteSettlements } from "../lib/db";

/** « Cédric » → « CÉ ». Les quatre membres se distinguent d'un coup d'œil. */
const initials = (name: string) => name.slice(0, 2).toUpperCase();

/**
 * Qui doit rembourser.
 *
 * Le solde de la caisse ne vit plus ici : il est tenu à part, sur tableur. Ne
 * reste que ce que l'app est seule à savoir — quel membre a encaissé un QR ou
 * reçu un cachet par virement, et ne l'a pas encore remis dans la boîte.
 */
export function CaisseTab() {
  const { concerts, sales, settlements, loading } = useStore();

  const debts = useMemo(
    () => payeeDebts(concerts, sales, settlements),
    [concerts, sales, settlements]
  );
  const owing = debts.filter((d) => d.remaining > 0);
  // Un solde négatif veut dire qu'on a enregistré plus de remises que le membre
  // n'a encaissé — typiquement un cachet basculé de « Virement » à « Liquide »
  // après coup. Le masquer laissait un total que rien à l'écran n'expliquait :
  // il apparaît donc à part, avec de quoi le corriger.
  const overpaid = debts.filter((d) => d.remaining < 0);
  const total = totalOwed(owing);

  const settle = async (payee: string) => {
    const plan = settlementPlan(concerts, sales, settlements, payee);
    if (plan.length === 0) {
      // Le dû ne vient que de concerts supprimés : il n'y a plus de fiche où
      // inscrire la remise. Le dire vaut mieux qu'un bouton qui ne fait rien.
      toast.error("Ce solde vient d'un concert supprimé : impossible de l'enregistrer.");
      return;
    }
    const sum = plan.reduce((n, e) => n + e.amountCents, 0);
    try {
      const ids = await createSettlements(
        plan.map((e) => ({ concertId: e.concertId, payee, amountCents: e.amountCents }))
      );
      // Un membre soldé quitte la liste, et son bouton « Annuler » avec lui :
      // l'annulation se rattrape donc ici, sinon une erreur de tap serait sans
      // retour.
      toast.success(`${payee} a remis ${formatEUR(sum)}`, {
        action: {
          label: "Annuler",
          onClick: () => {
            deleteSettlements(ids).catch((e) => toast.error((e as Error).message));
          },
        },
      });
    } catch (e) { toast.error((e as Error).message); }
  };

  /** Défait le dernier geste de remise d'un membre — toutes ses lignes. */
  const undoLast = async (payee: string) => {
    const mine = settlements.filter((r) => r.payee === payee);
    if (mine.length === 0) return;
    const latest = Math.max(...mine.map((r) => r.created_at));
    const ids = mine.filter((r) => r.created_at === latest).map((r) => r.id);
    try {
      await deleteSettlements(ids);
      toast.success("Remise annulée");
    } catch (e) { toast.error((e as Error).message); }
  };

  if (loading) {
    return <div className="px-6 py-12 text-center text-muted-foreground">Chargement…</div>;
  }

  return (
    <div className="px-4 pt-1 pb-4 space-y-4">
      <h1 className="font-display text-[22px]">À rembourser</h1>

      {owing.length === 0 && overpaid.length === 0 ? (
        <div className="px-2 py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-ok/15 text-ok flex items-center justify-center mx-auto">
            <Check className="h-6 w-6" />
          </div>
          <p className="text-muted-foreground text-sm">
            Personne ne doit rien. Tout ce qui a été encaissé par QR est revenu
            dans la caisse.
          </p>
        </div>
      ) : (
        <>
          <div className="card-surface rounded-2xl p-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Encore chez les membres
            </div>
            <div className="num font-display text-[2.9rem] text-warn leading-[0.92] mt-1.5">
              {formatEUR(total)}
            </div>
            <div className="text-xs text-muted-foreground mt-1.5">
              {owing.length} membre{owing.length > 1 ? "s" : ""} · encaissé par QR ou cachet viré
            </div>
          </div>

          <div className="card-surface rounded-2xl divide-y divide-border">
            {owing.map((d) => (
              <div key={d.payee} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-warn/20 text-warn font-display text-base">
                  {initials(d.payee)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] truncate">{d.payee}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    encaissé {formatEUR(d.collected)}
                    {d.settled > 0 && <> · remis {formatEUR(d.settled)}</>}
                  </div>
                </div>
                {/* Largeur fixe : sans elle, un « 400,00 » et un « 20,00 »
                    donnaient deux boutons de tailles différentes et le bord
                    droit de la liste dansait. */}
                <button
                  onClick={() => settle(d.payee)}
                  className="shrink-0 w-[132px] h-11 rounded-xl btn-primary flex items-center justify-between gap-1 px-2.5 active:scale-95 transition"
                >
                  <span className="text-[11px] font-semibold">Remis</span>
                  <span className="num text-[13.5px] font-bold">{formatEUR(d.remaining)}</span>
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {overpaid.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Remis en trop
          </div>
          <div className="card-surface rounded-2xl divide-y divide-border">
            {overpaid.map((d) => (
              <div key={d.payee} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-destructive/20 text-destructive">
                  <Undo2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] truncate">{d.payee}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    encaissé {formatEUR(d.collected)} · remis {formatEUR(d.settled)}
                  </div>
                </div>
                <button
                  onClick={() => undoLast(d.payee)}
                  className="shrink-0 w-[132px] h-11 rounded-xl border border-border bg-muted flex items-center justify-between gap-1 px-2.5 active:bg-muted/40 transition"
                >
                  <span className="text-[11px] font-semibold">Annuler</span>
                  <span className="num text-[13.5px] font-bold">{formatEUR(-d.remaining)}</span>
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground px-1">
            Plus de remises enregistrées que d'encaissements. Annule la dernière
            pour remettre le compte d'aplomb.
          </p>
        </div>
      )}
    </div>
  );
}
