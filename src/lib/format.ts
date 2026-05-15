export const formatEUR = (cents: number) =>
  new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" }).format((cents ?? 0) / 100);
