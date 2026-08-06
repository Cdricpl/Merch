import { Mic, ChevronRight } from "lucide-react";
import { formatEUR } from "../lib/format";
import type { Concert } from "../lib/types";

export function ConcertCard({
  concert,
  totalCents,
  totalItems,
  onOpen,
}: {
  concert: Concert;
  totalCents: number;
  totalItems: number;
  onOpen: () => void;
}) {
  const closed = concert.is_closed === true;
  const active = concert.is_active && !closed;

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden ${
        closed
          ? "bg-card/60 border-border/40"
          : active
            ? "bg-gradient-to-br from-card via-card to-primary/5 border-primary/30"
            : "bg-card border-border/60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Mic className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className={`font-display text-base truncate ${closed ? "text-muted-foreground" : "text-foreground"}`}>
                {concert.name}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                {new Date(concert.concert_date).toLocaleDateString("fr-BE", { day: "2-digit", month: "long", year: "numeric" })}
              </div>
            </div>
          </div>
          {closed && (
            <span className="text-[9px] uppercase tracking-widest bg-muted text-muted-foreground px-2 py-1 rounded shrink-0">
              Clôturé
            </span>
          )}
          {active && (
            <span className="text-[9px] uppercase tracking-widest bg-primary text-primary-foreground px-2 py-1 rounded shrink-0">
              Actif
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Caisse</div>
            <div className={`font-display text-xl ${closed ? "text-muted-foreground" : "text-primary"}`}>
              {formatEUR(totalCents)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ventes</div>
            <div className="font-display text-xl">{totalItems}</div>
          </div>
        </div>

        <button
          onClick={onOpen}
          className={`w-full mt-3 rounded-lg py-3 flex items-center justify-center gap-2 font-display tracking-wider text-sm ${
            closed
              ? "bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {closed ? "Voir le récap" : "Entrer"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
