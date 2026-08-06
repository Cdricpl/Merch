export type Family = {
  id: string;
  name: string;
  price_cents: number;
  low_alert: number;
  sort_order: number;
};

export type Variant = {
  id: string;
  family_id: string;
  label: string | null;
  stock: number;
  sort_order: number;
};

export type Concert = {
  id: string;
  name: string;
  concert_date: string;
  is_active: boolean;
  notes: string | null;
};

export type Sale = {
  id: string;
  concert_id: string;
  variant_id: string;
  quantity: number;
  unit_price_cents: number;
  created_at: string;
};
