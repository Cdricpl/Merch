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
