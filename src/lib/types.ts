export type Family = {
  id: string;
  name: string;
  price_cents: number;
  low_alert: number;
  sort_order: number;
  image?: string | null; // data URL (base64), compressed to ~50-100kB
};

export type Variant = {
  id: string;
  family_id: string;
  subcategory?: string | null; // e.g. "Homme", "Femme" — optional secondary dimension
  label: string | null;        // e.g. "S", "M", "2XL", or NULL for single-variant items
  stock: number;
  sort_order: number;
};

export type Concert = {
  id: string;
  name: string;
  concert_date: string;
  is_active: boolean;
  is_closed?: boolean;
  notes: string | null;
};

export type Sale = {
  id: string;
  concert_id: string;
  variant_id: string;
  quantity: number;
  unit_price_cents: number;
  created_at: number; // Date.now() — c'est bien un nombre côté Firestore
  // Optionnels : les ventes enregistrées avant le suivi des paiements n'ont
  // aucun de ces deux champs. Elles sont comptées à part plutôt que rangées
  // d'office en cash, ce qui fausserait les comptes sans prévenir.
  payment_method?: "cash" | "qr";
  payment_payee?: string | null; // nom du membre pour un QR, null en cash
};
