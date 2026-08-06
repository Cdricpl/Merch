// Extract a "category" tag + a shorter display name from the family name.
// "CD — No Nut's no Glory"  → { category: "CD",      display: "No Nut's no Glory" }
// "T-shirt Ardenne Heavy H" → { category: "T-SHIRT", display: "Ardenne Heavy H"   }

export function parseName(name: string): { category: string; display: string } {
  const em = name.match(/^([^—]+?)\s+—\s+(.+)$/);
  if (em) return { category: em[1].trim().toUpperCase(), display: em[2].trim() };

  const first = name.split(" ")[0];
  if (/^t-?shirt$/i.test(first)) {
    return { category: "T-SHIRT", display: name.slice(first.length).trim() };
  }
  return { category: "", display: name };
}
