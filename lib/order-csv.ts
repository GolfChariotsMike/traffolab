import {
  COLOUR_PAIRS,
  SIZE_PRESETS,
  createLegendDesign,
  createOrderLine,
  type ColourPairId,
  type OrderLine,
} from "@/lib/label-design";

export const TEMPLATE_FIELDS = ["colour", "size", "text", "qty"] as const;
export type CsvField = (typeof TEMPLATE_FIELDS)[number];
export type ColumnMapping = Record<CsvField, number | null>;

export const MAPPING_STORAGE_KEY = "trafflabels.csvMap.v1";
export const TEMPLATE_DOWNLOAD_PATH = "/templates/trafflabels-order-template.csv";
export const TEMPLATE_FILENAME = "trafflabels-order-template.csv";

export const TEMPLATE_CSV = [
  TEMPLATE_FIELDS.join(","),
  "yellow-black,20x10,MAIN SWITCH,10",
  "white-black,60x20,PV ISOLATOR,4",
  "red-white,100x50,DB-1 CIRCUIT 14,2",
].join("\n") + "\n";

const FIELD_ALIASES: Record<CsvField, string[]> = {
  colour: ["colour", "color", "colour pair", "color pair", "laminate"],
  size: ["size", "preset", "dimensions", "wxh"],
  text: ["text", "legend", "label", "engraving", "wording"],
  qty: ["qty", "qty.", "quantity", "count", "qnty"],
};

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  headerless: boolean;
};

export type CsvCellError = {
  field: CsvField;
  message: string;
};

export type PreviewRow = {
  sourceIndex: number;
  values: Record<CsvField, string>;
  errors: CsvCellError[];
  colourPair: ColourPairId | null;
  sizeId: string | null;
  widthMm: number | null;
  heightMm: number | null;
  text: string;
  qty: number | null;
};

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

export function parseCsv(text: string): string[][] {
  const source = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < source.length) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      field = "";
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) {
    rows.push(row);
  }
  return rows;
}

function compactKey(value: string) {
  return value.toLowerCase().replace(/[\s/_×x-]+/g, "");
}

export function parseColour(value: string): ColourPairId | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  if (raw in COLOUR_PAIRS) return raw as ColourPairId;

  const compact = compactKey(raw);
  for (const pair of Object.values(COLOUR_PAIRS)) {
    const idKey = compactKey(pair.id);
    const labelKey = compactKey(pair.label);
    const faceCoreKey = compactKey(`${pair.faceLabel} ${pair.coreLabel}`);
    if (compact === idKey || compact === labelKey || compact === faceCoreKey) {
      return pair.id;
    }
  }
  return null;
}

export function parseSize(value: string) {
  const raw = value
    .trim()
    .toLowerCase()
    .replace(/mm/g, "")
    .replace(/[×]/g, "x")
    .replace(/\s+/g, "");
  if (!raw) return null;
  return (
    SIZE_PRESETS.find(
      (preset) =>
        preset.id === raw || `${preset.widthMm}x${preset.heightMm}` === raw
    ) ?? null
  );
}

export function parseLegend(value: string) {
  return value
    .replaceAll("\\n", "\n")
    .split("|")
    .map((part) => part.trim())
    .join("\n")
    .trim();
}

export function parseQty(value: string): { qty: number } | { error: string } {
  const trimmed = value.trim();
  if (!trimmed) return { error: "Qty is required and must be 1–999." };
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Qty must be a whole number from 1 to 999." };
  }
  const qty = Number(trimmed);
  if (qty < 1 || qty > 999) {
    return { error: "Qty must be between 1 and 999." };
  }
  return { qty };
}

export function allowedColourHint() {
  return Object.values(COLOUR_PAIRS)
    .map((pair) => `${pair.id} (${pair.label})`)
    .join(", ");
}

export function allowedSizeHint() {
  return SIZE_PRESETS.map((preset) => preset.id).join(", ");
}

export function emptyMapping(): ColumnMapping {
  return { colour: null, size: null, text: null, qty: null };
}

export function isCompleteMapping(mapping: ColumnMapping) {
  return TEMPLATE_FIELDS.every((field) => mapping[field] !== null);
}

export function headerFingerprint(headers: string[]) {
  return headers.map((header) => header.trim().toLowerCase()).join("|");
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const mapping = emptyMapping();
  const used = new Set<number>();
  const normalized = headers.map((header) => header.trim().toLowerCase());

  for (const field of TEMPLATE_FIELDS) {
    const index = normalized.findIndex(
      (header, headerIndex) =>
        !used.has(headerIndex) && FIELD_ALIASES[field].includes(header)
    );
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

function looksLikeTemplateDataRow(cells: string[]) {
  return (
    parseColour(cells[0] ?? "") !== null &&
    parseSize(cells[1] ?? "") !== null &&
    parseLegend(cells[2] ?? "").length > 0 &&
    !("error" in parseQty(cells[3] ?? ""))
  );
}

export function loadCsvDocument(text: string): ParsedCsv {
  const table = parseCsv(text);
  if (table.length === 0) {
    throw new Error("That CSV is empty. Add a header row and at least one legend.");
  }

  if (looksLikeTemplateDataRow(table[0])) {
    const width = Math.max(...table.map((row) => row.length), 4);
    return {
      headers: Array.from({ length: width }, (_, index) => `Column ${index + 1}`),
      rows: table.map((row) => padRow(row, width)),
      headerless: true,
    };
  }

  const headers = table[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  const width = Math.max(headers.length, ...table.slice(1).map((row) => row.length));
  return {
    headers: padRow(headers, width),
    rows: table.slice(1).map((row) => padRow(row, width)),
    headerless: false,
  };
}

function padRow(row: string[], width: number) {
  return Array.from({ length: width }, (_, index) => row[index] ?? "");
}

export function resolveMapping(
  headers: string[],
  stored?: ColumnMapping | null
): ColumnMapping {
  if (stored && isCompleteMapping(stored)) {
    const inRange = TEMPLATE_FIELDS.every((field) => {
      const index = stored[field];
      return index !== null && index >= 0 && index < headers.length;
    });
    if (inRange) return stored;
  }
  const suggested = suggestMapping(headers);
  if (looksLikeTemplateDataRow(headers) || headers.every((header) => /^column \d+$/i.test(header))) {
    if (!isCompleteMapping(suggested) && headers.length >= 4) {
      return { colour: 0, size: 1, text: 2, qty: 3 };
    }
  }
  return suggested;
}

export function readStoredMapping(fingerprint: string): ColumnMapping | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(localStorage.getItem(MAPPING_STORAGE_KEY) ?? "null") as
      | Record<string, ColumnMapping>
      | null;
    const mapping = raw?.[fingerprint];
    if (!mapping || typeof mapping !== "object") return null;
    return TEMPLATE_FIELDS.every((field) => field in mapping) ? mapping : null;
  } catch {
    return null;
  }
}

export function writeStoredMapping(fingerprint: string, mapping: ColumnMapping) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.parse(localStorage.getItem(MAPPING_STORAGE_KEY) ?? "{}") as Record<
      string,
      ColumnMapping
    >;
    raw[fingerprint] = mapping;
    localStorage.setItem(MAPPING_STORAGE_KEY, JSON.stringify(raw));
  } catch {
    // ignore quota / private mode
  }
}

export function previewMappedRows(
  document: ParsedCsv,
  mapping: ColumnMapping
): PreviewRow[] {
  return document.rows.map((row, sourceIndex) => {
    const values = {
      colour: mapping.colour === null ? "" : (row[mapping.colour] ?? ""),
      size: mapping.size === null ? "" : (row[mapping.size] ?? ""),
      text: mapping.text === null ? "" : (row[mapping.text] ?? ""),
      qty: mapping.qty === null ? "" : (row[mapping.qty] ?? ""),
    };
    const errors: CsvCellError[] = [];

    if (mapping.colour === null) {
      errors.push({ field: "colour", message: "Map a Colour column." });
    }
    const colourPair = parseColour(values.colour);
    if (mapping.colour !== null && !colourPair) {
      errors.push({
        field: "colour",
        message: `Unknown colour. Use ${allowedColourHint()}.`,
      });
    }

    if (mapping.size === null) {
      errors.push({ field: "size", message: "Map a Size column." });
    }
    const size = parseSize(values.size);
    if (mapping.size !== null && !size) {
      errors.push({
        field: "size",
        message: `Unknown size. Allowed presets: ${allowedSizeHint()}.`,
      });
    }

    if (mapping.text === null) {
      errors.push({ field: "text", message: "Map a Text column." });
    }
    const text = parseLegend(values.text);
    if (mapping.text !== null && text.length === 0) {
      errors.push({ field: "text", message: "Text is required." });
    }

    if (mapping.qty === null) {
      errors.push({ field: "qty", message: "Map a Qty column." });
    }
    const qtyResult = parseQty(values.qty);
    if (mapping.qty !== null && "error" in qtyResult) {
      errors.push({ field: "qty", message: qtyResult.error });
    }

    return {
      sourceIndex,
      values,
      errors,
      colourPair,
      sizeId: size?.id ?? null,
      widthMm: size?.widthMm ?? null,
      heightMm: size?.heightMm ?? null,
      text,
      qty: "qty" in qtyResult ? qtyResult.qty : null,
    };
  });
}

export function orderLinesFromPreview(rows: PreviewRow[]): OrderLine[] {
  return rows.flatMap((row) => {
    if (
      row.errors.length > 0 ||
      !row.colourPair ||
      row.widthMm === null ||
      row.heightMm === null ||
      row.qty === null ||
      row.text.length === 0
    ) {
      return [];
    }
    return [
      createOrderLine(
        createLegendDesign(row.colourPair, row.widthMm, row.heightMm, row.text),
        row.qty
      ),
    ];
  });
}

export function downloadTemplateCsv() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = TEMPLATE_FILENAME;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
