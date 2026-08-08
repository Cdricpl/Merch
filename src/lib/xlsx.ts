// Écriture d'un classeur Excel minimal, sans dépendance.
//
// Le CSV ne transporte aucune largeur de colonne : Excel ouvre tout à la
// largeur par défaut, et une date de seize caractères s'y affiche « ######## ».
// Aucun réglage du CSV n'y change quoi que ce soit — il faut un vrai .xlsx.
//
// Un .xlsx est un ZIP de fichiers XML. On n'en écrit que le strict minimum :
// pas de compression (méthode « stocké »), pas de table de chaînes partagées,
// une seule feuille. Suffisant pour Excel comme pour Google Sheets, et cent
// fois plus léger qu'embarquer une bibliothèque dans une app de stand.

export type Cell = string | number | null;

export type Row = {
  cells: Cell[];
  bold?: boolean;
};

export type Sheet = {
  name: string;
  /** Largeur de chaque colonne, en caractères. */
  widths: number[];
  /**
   * Colonnes dont les nombres sont des entiers — une quantité s'écrit « 2 »,
   * pas « 2,00 ».
   */
  intCols?: number[];
  rows: Row[];
};

// ── XML ───────────────────────────────────────────────────────────────────

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** 0 → A, 25 → Z, 26 → AA. */
function colName(i: number): string {
  let n = i + 1, out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// Styles : 0 normal, 1 gras, 2 montant, 3 montant gras. L'ordre suit celui
// déclaré dans cellXfs plus bas.
const S_PLAIN = 0, S_BOLD = 1, S_NUM = 2, S_NUM_BOLD = 3;

function sheetXml(sheet: Sheet): string {
  const ints = new Set(sheet.intCols ?? []);
  const cols = sheet.widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");

  const rows = sheet.rows.map((row, r) => {
    const cells = row.cells.map((v, c) => {
      if (v === null || v === "") return "";
      const ref = `${colName(c)}${r + 1}`;
      if (typeof v === "number") {
        const style = ints.has(c)
          ? (row.bold ? S_BOLD : S_PLAIN)
          : (row.bold ? S_NUM_BOLD : S_NUM);
        return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
      }
      // Chaînes en ligne : évite une table de chaînes partagées, dont on n'a
      // aucun besoin ici. Les dates sont écrites comme du texte, ce qui les
      // met à l'abri d'une réinterprétation par le tableur.
      return `<c r="${ref}" s="${row.bold ? S_BOLD : S_PLAIN}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    }).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf xfId="0" numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf xfId="0" numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf xfId="0" numFmtId="164" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf xfId="0" numFmtId="164" fontId="1" fillId="0" borderId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

// ── ZIP (méthode « stocké ») ──────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files: Array<{ name: string; text: string }>): Blob {
  const enc = new TextEncoder();
  // Uint8Array<ArrayBuffer> et non Uint8Array tout court : Blob n'accepte pas
  // une vue dont le tampon pourrait être partagé.
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = enc.encode(f.text) as Uint8Array<ArrayBuffer>;
    const crc = crc32(data);

    const local = new Uint8Array(new ArrayBuffer(30 + nameBytes.length));
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    parts.push(local, data);

    const cen = new Uint8Array(new ArrayBuffer(46 + nameBytes.length));
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + data.length;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(new ArrayBuffer(22));
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Un classeur d'une feuille, prêt à être partagé ou téléchargé. */
export function buildXlsx(sheet: Sheet): Blob {
  return zip([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheet.name)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", text: STYLES },
    { name: "xl/worksheets/sheet1.xml", text: sheetXml(sheet) },
  ]);
}
