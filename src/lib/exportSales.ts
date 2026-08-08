// Le classeur d'un concert : ses ventes, son cachet, ses remboursements, et
// les totaux qui permettent de recouper la soirée d'un coup d'œil.

import { buildXlsx, type Row } from "./xlsx";
import { PAYEES } from "./payment";
import {
  saleTotalCents,
  type Concert, type Family, type Sale, type Settlement, type Variant,
} from "./types";

const eur = (cents: number) => cents / 100;

function stamp(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// « Ristourne » et non « remise » : dans cette app, une remise est un membre
// qui rend ce qu'il a encaissé. Garder le même mot pour les deux rendrait la
// feuille illisible dès qu'on y met les deux.
const HEADERS = [
  "Date", "Type", "Produit", "Taille", "Quantité",
  "Prix unitaire", "Ristourne", "Montant", "Paiement", "Membre",
];

// La première est large exprès : c'est elle qui affichait des dièses.
const WIDTHS = [17, 15, 26, 12, 9, 13, 11, 12, 14, 10];

/** Colonne des montants, où viennent s'aligner les totaux du bas. */
const MONTANT = 7;

/** La quantité est un entier : « 2 » et non « 2,00 ». */
const INT_COLS = [4];

/**
 * Le classeur d'un concert.
 *
 * Les remboursements y figurent : sans eux, un QR resterait éternellement
 * « chez quelqu'un » aux yeux du fichier alors que l'argent est rentré. La
 * colonne Type les distingue des ventes, car additionner une vente QR et son
 * remboursement compterait le même argent deux fois.
 */
export function salesWorkbook(
  concert: Concert,
  sales: Sale[],
  families: Family[],
  variants: Variant[],
  settlements: Settlement[] = [],
): Blob {
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const familyById = new Map(families.map((f) => [f.id, f]));

  type Line = { at: number; cells: (string | number | null)[] };
  const lines: Line[] = [];

  let ventes = 0;
  for (const s of sales) {
    const v = variantById.get(s.variant_id);
    const f = v ? familyById.get(v.family_id) : undefined;
    // Un article supprimé depuis la vente ne doit pas faire disparaître sa
    // ligne : le montant, lui, a bien été encaissé.
    const produit = f?.name ?? "Article supprimé";
    const taille = v ? [v.subcategory, v.label].filter(Boolean).join(" ") : "";
    const paiement = s.payment_method === "qr" ? "QR"
      : s.payment_method === "cash" ? "Liquide"
      : "Non renseigné";

    ventes += saleTotalCents(s);
    lines.push({ at: s.created_at, cells: [
      stamp(s.created_at), "Vente", produit, taille, s.quantity,
      eur(s.unit_price_cents), eur(s.discount_cents ?? 0), eur(saleTotalCents(s)),
      paiement, s.payment_method === "qr" ? (s.payment_payee || "?") : "",
    ]});
  }

  const fee = concert.fee_cents ?? 0;
  const feeVire = concert.fee_method === "virement";
  if (fee > 0) {
    const at = concert.fee_at ?? (Date.parse(concert.concert_date) || 0);
    lines.push({ at, cells: [
      stamp(at), "Cachet", concert.name, "", null, null, null,
      eur(fee), feeVire ? "Virement" : "Liquide", feeVire ? (concert.fee_payee || "?") : "",
    ]});
  }

  for (const r of settlements) {
    lines.push({ at: r.created_at, cells: [
      stamp(r.created_at), "Remboursement", "", "", null, null, null,
      eur(r.amount_cents), "Liquide", r.payee,
    ]});
  }

  lines.sort((a, b) => a.at - b.at);

  // Ce que les membres détiennent encore POUR CE CONCERT, membre par membre :
  // les QR et le cachet viré, moins ce que chacun a rendu. Le total seul
  // obligeait à rouvrir l'app pour savoir à qui réclamer.
  const parMembre = new Map<string, number>();
  const add = (who: string, cents: number) =>
    parMembre.set(who, (parMembre.get(who) ?? 0) + cents);

  if (feeVire) add(concert.fee_payee || "?", fee);
  for (const s of sales) {
    if (s.payment_method === "qr") add(s.payment_payee || "?", saleTotalCents(s));
  }
  for (const r of settlements) add(r.payee, -r.amount_cents);

  const rank = (who: string) => {
    const i = PAYEES.indexOf(who as (typeof PAYEES)[number]);
    return i === -1 ? PAYEES.length : i;
  };
  const restes = [...parMembre.entries()]
    .filter(([, cents]) => cents !== 0)
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b));
  const reste = restes.reduce((n, [, cents]) => n + cents, 0);

  const rows: Row[] = [{ cells: HEADERS, bold: true }];
  for (const l of lines) rows.push({ cells: l.cells });

  // Les totaux en bas, séparés par une ligne vide : l'en-tête reste en
  // première ligne, donc le tri et le filtre du tableur marchent encore.
  const total = (label: string, cents: number): Row => {
    const cells: (string | number | null)[] = new Array(HEADERS.length).fill(null);
    cells[0] = label;
    cells[MONTANT] = eur(cents);
    return { cells, bold: true };
  };
  rows.push({ cells: [] });
  rows.push(total("Total des ventes", ventes));
  if (fee > 0) rows.push(total(`Cachet${feeVire ? " (virement)" : ""}`, fee));
  rows.push(total("Total recettes", ventes + fee));
  rows.push({ cells: [] });
  rows.push(total("Reste à rembourser par les membres", reste));
  for (const [who, cents] of restes) {
    const cells: (string | number | null)[] = new Array(HEADERS.length).fill(null);
    cells[0] = `    ${who}`;
    cells[MONTANT] = eur(cents);
    // Le nom est repris dans sa colonne : le tableur peut alors le retrouver
    // par recherche, sans dépendre de l'indentation.
    cells[HEADERS.length - 1] = who;
    rows.push({ cells });
  }

  return buildXlsx({ name: "Ventes", widths: WIDTHS, intCols: INT_COLS, rows });
}

/**
 * « Durbuy Rock » + « 2026-08-19 » → « Durbuy Rock 2026-08-19.xlsx »
 *
 * Le nom du concert est gardé tel quel, accents et majuscules compris : c'est
 * lui qu'on cherche des yeux dans un dossier. Seuls les caractères qu'un
 * système de fichiers refuse sont retirés.
 *
 * La date reste au format ISO malgré son air technique : c'est le seul qui
 * range les fichiers dans l'ordre chronologique quand on trie un dossier par
 * nom.
 */
export function salesFileName(concertName: string, concertDate: string): string {
  const nom = concertName
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    || "Concert";
  return `${nom} ${concertDate}.xlsx`;
}

/**
 * Propose le fichier à l'utilisateur.
 *
 * Sur téléphone, le partage natif est de loin le plus utile : il envoie
 * directement vers Drive, un mail ou une conversation. Là où il n'existe pas,
 * on retombe sur un téléchargement classique.
 */
export async function offerFile(blob: Blob, name: string): Promise<void> {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & {
    canShare?: (d: { files: File[] }) => boolean;
    share?: (d: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: name });
      return;
    } catch (e) {
      // Partage refusé : ne pas enchaîner sur un téléchargement non demandé.
      if ((e as Error).name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
