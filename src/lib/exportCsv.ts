// Export du journal de caisse, pour relecture sur grand écran.
//
// CSV plutôt qu'un vrai .xlsx : Excel comme Google Sheets l'ouvrent d'un clic,
// et ça n'ajoute aucune dépendance à une app qui doit rester légère au stand.
//
// Deux détails qui font la différence à l'ouverture :
//   · un BOM UTF-8, sans quoi Excel massacre les accents ;
//   · le point-virgule en séparateur et la virgule en décimale, comme l'attend
//     un Excel francophone — qui reconnaît alors les montants comme des nombres
//     et non comme du texte.

import type { LedgerRow } from "./caisse";

const SEP = ";";

/** Entoure de guillemets ce qui contient un séparateur, un guillemet ou un saut. */
function cell(v: string): string {
  return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** « -4500 » → « -45,00 » : virgule décimale, pas de séparateur de milliers. */
function amount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** Horodatage ISO court : trié correctement, et compris des deux tableurs. */
function stamp(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const HEADERS = [
  "Date", "Type", "Libellé", "Concert", "Membre",
  "Montant", "Dans la caisse", "Solde caisse",
];

export function ledgerCsv(rows: LedgerRow[]): string {
  const lines = [HEADERS.join(SEP)];
  for (const r of rows) {
    lines.push([
      stamp(r.at),
      r.type,
      r.label,
      r.concert ?? "",
      r.payee ?? "",
      amount(r.cents),
      r.inBox ? "oui" : "non",
      // Un solde ne veut rien dire en face d'une ligne qui ne touche pas la
      // boîte : le laisser vide évite de le lire comme un cumul.
      r.inBox ? amount(r.balance) : "",
    ].map((v) => cell(String(v))).join(SEP));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvFileName(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `caisse-ardenne-heavy-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.csv`;
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
      await nav.share({ files: [file], title: "Caisse Ardenne Heavy" });
      return;
    } catch (e) {
      // Partage refusé par l'utilisateur : ne pas enchaîner sur un
      // téléchargement qu'il n'a pas demandé.
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
  // Laisser au navigateur le temps de démarrer le téléchargement avant de
  // libérer l'URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
