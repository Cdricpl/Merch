// Modes de paiement acceptés au stand.
//
// Le QR est nominatif : l'argent arrive sur le compte d'un membre précis, il
// faut donc savoir lequel pour faire les comptes en fin de tournée.

export const PAYEES = ["Ludo", "Sim", "Nico", "Cédric"] as const;
export type Payee = (typeof PAYEES)[number];

export type PaymentMethod = "cash" | "qr";

export type Payment = {
  method: PaymentMethod;
  payee: Payee | null; // renseigné uniquement pour un QR
};

export const CASH: Payment = { method: "cash", payee: null };

/** Libellé court pour l'affichage (récap, listes). */
export function paymentLabel(method: PaymentMethod | undefined, payee: string | null | undefined): string {
  if (method === "qr") return payee ? `QR ${payee}` : "QR";
  if (method === "cash") return "Cash";
  // Ventes enregistrées avant l'ajout du suivi des paiements : on ne les compte
  // ni en cash ni en QR, sous peine de fausser les comptes en silence.
  return "Non renseigné";
}
