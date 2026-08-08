// Export des ventes d'un concert, pour relecture dans un tableur.
//
// CSV plutôt qu'un vrai .xlsx : Excel comme Google Sheets l'ouvrent d'un clic,
// et ça n'ajoute aucune dépendance à une app qui doit rester légère au stand.
//
// Trois détails décident de la lisibilité à l'ouverture :
//   · un BOM UTF-8, sans quoi Excel massacre les accents ;
//   · le point-virgule en séparateur et la virgule en décimale, comme l'attend
//     un Excel francophone — qui reconnaît alors les montants comme des nombres
//     et non comme du texte ;
//   · un horodatage ISO, trié correctement et compris des deux tableurs.

import {
  saleTotalCents,
  type Concert, type Family, type Sale, type Settlement, type Variant,
} from "./types";

const SEP = ";";

/** Entoure de guillemets ce qui contient un séparateur, un guillemet ou un saut. */
function cell(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** « 3600 » → « 36,00 » : virgule décimale, pas de séparateur de milliers. */
function amount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function stamp(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// « Ristourne » et non « remise » : dans cette app, une remise est un membre
// qui rend ce qu'il a encaissé. Garder le même mot pour les deux rendrait le
// fichier illisible dès qu'on y met les deux.
const HEADERS = [
  "Date", "Type", "Produit", "Taille", "Quantité",
  "Prix unitaire", "Ristourne", "Montant", "Paiement", "Membre",
];

/**
 * Les ventes d'un concert, et les remboursements de ses QR, dans l'ordre.
 *
 * Le moyen de paiement et le membre sont en clair : c'est par eux qu'on
 * retrouve, dans le tableur, ce qui est arrivé sur le compte de quelqu'un
 * plutôt que dans la boîte. Les remboursements suivent, sur leurs propres
 * lignes — sans eux, un QR resterait éternellement « chez quelqu'un » aux yeux
 * du fichier alors que l'argent est rentré.
 *
 * Le cachet de la soirée y figure aussi, sur sa propre ligne.
 *
 * La colonne Type permet de sommer les ventes sans y mêler les
 * remboursements : additionner les deux compterait le même argent deux fois.
 */
export function salesCsv(
  concert: Concert,
  sales: Sale[],
  families: Family[],
  variants: Variant[],
  settlements: Settlement[] = [],
): string {
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const familyById = new Map(families.map((f) => [f.id, f]));

  type Row = { at: number; cells: string[] };
  const rows: Row[] = [];

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

    rows.push({ at: s.created_at, cells: [
      stamp(s.created_at),
      "Vente",
      produit,
      taille,
      String(s.quantity),
      amount(s.unit_price_cents),
      amount(s.discount_cents ?? 0),
      amount(saleTotalCents(s)),
      paiement,
      s.payment_method === "qr" ? (s.payment_payee || "?") : "",
    ]});
  }

  // Le cachet n'est pas une vente, mais il fait partie de ce que la soirée a
  // rapporté : le laisser dehors obligerait à le ressaisir à la main.
  const fee = concert.fee_cents ?? 0;
  if (fee > 0) {
    const vire = concert.fee_method === "virement";
    rows.push({
      at: concert.fee_at ?? (Date.parse(concert.concert_date) || 0),
      cells: [
        stamp(concert.fee_at ?? (Date.parse(concert.concert_date) || 0)),
        "Cachet",
        concert.name,
        "", "", "",
        "",
        amount(fee),
        vire ? "Virement" : "Liquide",
        vire ? (concert.fee_payee || "?") : "",
      ],
    });
  }

  for (const r of settlements) {
    rows.push({ at: r.created_at, cells: [
      stamp(r.created_at),
      "Remboursement",
      "", "", "", "",
      "",
      amount(r.amount_cents),
      "Liquide",
      r.payee,
    ]});
  }

  rows.sort((a, b) => a.at - b.at);

  const lines = [HEADERS.join(SEP)];
  for (const r of rows) lines.push(r.cells.map(cell).join(SEP));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** « Fête du Rock ! » → « ventes-fete-du-rock-2026-08-05.csv » */
export function salesFileName(concertName: string, concertDate: string): string {
  const slug = concertName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    || "concert";
  return `ventes-${slug}-${concertDate}.csv`;
}

/**
 * Propose le fichier à l'utilisateur.
 *
 * Sur téléphone, le partage natif est de loin le plus utile : il envoie
 * directement vers Drive, un mail ou une conversation. Là où il n'existe pas,
 * on retombe sur un téléchargement classique.
 */
export async function offerCsv(csv: string, name: string): Promise<void> {
  const file = new File([csv], name, { type: "text/csv" });
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
