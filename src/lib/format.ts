export const formatEUR = (cents: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format((cents ?? 0) / 100);

export const generateJoinCode = () => {
  // 6 chars, no ambiguous (0/O, 1/I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export const DEFAULT_PRODUCTS: Array<{ name: string; variant: string | null; price_cents: number; sort_order: number }> = [
  { name: "T-shirt Homme", variant: "S", price_cents: 2000, sort_order: 10 },
  { name: "T-shirt Homme", variant: "M", price_cents: 2000, sort_order: 11 },
  { name: "T-shirt Homme", variant: "L", price_cents: 2000, sort_order: 12 },
  { name: "T-shirt Homme", variant: "XL", price_cents: 2000, sort_order: 13 },
  { name: "T-shirt Femme", variant: "S", price_cents: 2000, sort_order: 20 },
  { name: "T-shirt Femme", variant: "M", price_cents: 2000, sort_order: 21 },
  { name: "T-shirt Femme", variant: "L", price_cents: 2000, sort_order: 22 },
  { name: "Décapsuleur", variant: null, price_cents: 500, sort_order: 30 },
  { name: "Album", variant: null, price_cents: 1500, sort_order: 40 },
];
