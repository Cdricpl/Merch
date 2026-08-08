import { Flame, ChevronRight } from "lucide-react";
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
    <div className={`${active ? "card-active" : "card-surface"} rounded-2xl p-3`}>
      <div className="flex items-center gap-2.5">
        <Flame className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
        <h3
          className={`font-display text-[19px] leading-none truncate flex-1 min-w-0 ${
            closed ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {concert.name}
        </h3>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 ${
            active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {closed ? "Clôturé" : active ? "Actif" : "Pause"}
        </span>
      </div>

      <div className="text-[12px] uppercase tracking-wider text-muted-foreground mt-1.5 ml-[28px]">
        {new Date(concert.concert_date).toLocaleDateString("fr-BE", {
          day: "2-digit", month: "long", year: "numeric",
        })}
      </div>

      <div className="flex items-stretch mt-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Recette</div>
          <div className={`font-display text-[21px] leading-none mt-1 ${closed ? "text-foreground/70" : "text-primary"}`}>
            {formatEUR(totalCents)}
          </div>
        </div>
        <div className="w-px bg-border mx-3" />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Ventes</div>
          <div className="font-display text-[21px] leading-none mt-1">{totalItems}</div>
        </div>
      </div>

      <button
        onClick={onOpen}
        className={`w-full mt-3 rounded-xl h-10 flex items-center justify-center gap-2 font-display tracking-wider text-[15px] ${
          closed ? "bg-muted text-muted-foreground" : "btn-primary"
        }`}
      >
        {closed ? "Voir le récap" : "Entrer"}
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
