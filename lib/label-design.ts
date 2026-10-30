export const DESIGN_VERSION = 1 as const;

/** Smallest trade preset is 20 × 10 (Mike’s physical sample). */
export const MIN_PLATE_MM = 10;
export const MAX_PLATE_WIDTH_MM = 300;
export const MAX_PLATE_HEIGHT_MM = 200;

export const MIN_FONT_MM = 3;
/** Largest em that still fits the tallest allowed plate, and the checkout ceiling. */
export const MAX_FONT_MM = 80;

export const LINE_HEIGHT = 1.15;
/** Fallback advance for characters outside the measured Arial set. */
export const CHAR_WIDTH_EM = 0.68;
/** System Arial, so the browser preview and LightBurn on Windows use the same face. */
export const ENGRAVE_FONT_FAMILY = "Arial, Helvetica, sans-serif";
/** Regular Arial. Semi-bold reads as bold engraving. */
export const ENGRAVE_FONT_WEIGHT = 400;

/**
 * Arial Regular. Caps are about 0.72em, not the 1.15 line box, so auto-fit
 * uses this glyph box or the type stays small inside the plate.
 */
const GLYPH_ASCENT_EM = 0.73;
/** Cap height of Arial Regular, as a fraction of the em. */
export const CAP_HEIGHT_EM = GLYPH_ASCENT_EM;
const GLYPH_ASCENT_TALL_EM = 0.78;
const GLYPH_DESCENT_EM = 0.22;
const GLYPH_DESCENT_FLAT_EM = 0.02;
const DESCENDER_RE = /[gjpqyQ,;()[\]{}]/;
const TALL_RE = /[()[\]{}|]/;

/** Advance widths in em, measured from Arial Regular (weight 400). */
const GLYPH_EM: Record<string, number> = {
  " ": 0.278,
  "-": 0.333,
  _: 0.556,
  ".": 0.278,
  ",": 0.278,
  ":": 0.278,
  ";": 0.278,
  "/": 0.278,
  "&": 0.667,
  "+": 0.584,
  "#": 0.556,
  "0": 0.556,
  "1": 0.556,
  "2": 0.556,
  "3": 0.556,
  "4": 0.556,
  "5": 0.556,
  "6": 0.556,
  "7": 0.556,
  "8": 0.556,
  "9": 0.556,
  A: 0.667,
  B: 0.667,
  C: 0.722,
  D: 0.722,
  E: 0.667,
  F: 0.611,
  G: 0.778,
  H: 0.722,
  I: 0.278,
  J: 0.5,
  K: 0.667,
  L: 0.556,
  M: 0.833,
  N: 0.722,
  O: 0.778,
  P: 0.667,
  Q: 0.778,
  R: 0.722,
  S: 0.667,
  T: 0.611,
  U: 0.722,
  V: 0.667,
  W: 0.944,
  X: 0.667,
  Y: 0.667,
  Z: 0.611,
  a: 0.556,
  b: 0.556,
  c: 0.5,
  d: 0.556,
  e: 0.556,
  f: 0.278,
  g: 0.556,
  h: 0.556,
  i: 0.222,
  j: 0.222,
  k: 0.5,
  l: 0.222,
  m: 0.833,
  n: 0.556,
  o: 0.556,
  p: 0.556,
  q: 0.556,
  r: 0.333,
  s: 0.5,
  t: 0.278,
  u: 0.556,
  v: 0.5,
  w: 0.722,
  x: 0.5,
  y: 0.5,
  z: 0.5,
};

export const SIZE_PRESETS = [
  { id: "20x10", label: "20 × 10", widthMm: 20, heightMm: 10 },
  { id: "60x20", label: "60 × 20", widthMm: 60, heightMm: 20 },
  { id: "80x30", label: "80 × 30", widthMm: 80, heightMm: 30 },
  { id: "100x50", label: "100 × 50", widthMm: 100, heightMm: 50 },
  { id: "150x50", label: "150 × 50", widthMm: 150, heightMm: 50 },
] as const;

export type SizePresetId = (typeof SIZE_PRESETS)[number]["id"];

export const COLOUR_PAIRS = {
  "white-black": {
    id: "white-black",
    label: "White / black",
    faceLabel: "White",
    coreLabel: "Black",
    face: "#FFFFFF",
    core: "#111111",
  },
  "yellow-black": {
    id: "yellow-black",
    label: "Yellow / black",
    faceLabel: "Yellow",
    coreLabel: "Black",
    face: "#F5D000",
    core: "#111111",
  },
  "red-white": {
    id: "red-white",
    label: "Red / white",
    faceLabel: "Red",
    coreLabel: "White",
    face: "#C8102E",
    core: "#FFFFFF",
  },
  "black-white": {
    id: "black-white",
    label: "Black / white",
    faceLabel: "Black",
    coreLabel: "White",
    face: "#111111",
    core: "#FFFFFF",
  },
} as const;

export type ColourPairId = keyof typeof COLOUR_PAIRS;
export type TextAlign = "left" | "center" | "right";

export type TextObject = {
  id: string;
  type: "text";
  text: string;
  x: number;
  y: number;
  fontSize: number;
  align: TextAlign;
};

export type LabelDesign = {
  version: typeof DESIGN_VERSION;
  widthMm: number;
  heightMm: number;
  colourPair: ColourPairId;
  adhesive3m: boolean;
  objects: TextObject[];
};

export type OrderLine = {
  id: string;
  qty: number;
  design: LabelDesign;
  svg: string;
};

const DEFAULT_PRESET = SIZE_PRESETS[0];

export const DEFAULT_DESIGN: LabelDesign = {
  version: DESIGN_VERSION,
  widthMm: DEFAULT_PRESET.widthMm,
  heightMm: DEFAULT_PRESET.heightMm,
  colourPair: "yellow-black",
  adhesive3m: false,
  objects: [],
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function nearestSizePreset(widthMm: number, heightMm: number) {
  return SIZE_PRESETS.reduce((best, preset) => {
    const dist =
      (preset.widthMm - widthMm) ** 2 + (preset.heightMm - heightMm) ** 2;
    const bestDist =
      (best.widthMm - widthMm) ** 2 + (best.heightMm - heightMm) ** 2;
    return dist < bestDist ? preset : best;
  });
}

/**
 * Nearest trade preset. Opt-in only — the designer and CSV/order paths keep
 * the exact millimetres instead of snapping.
 */
export function snapToSizePreset(widthMm: number, heightMm: number) {
  const preset = nearestSizePreset(widthMm, heightMm);
  return { widthMm: preset.widthMm, heightMm: preset.heightMm };
}

/** Bound the range, then snap to a preset. Preset-only callers use this. */
export function clampPlateSize(widthMm: number, heightMm: number) {
  const size = clampFreeformPlateSize(widthMm, heightMm);
  return snapToSizePreset(size.widthMm, size.heightMm);
}

/** Designer, CSV, and order-draft path: keep exact millimetres, only bound the range. */
export function clampFreeformPlateSize(widthMm: number, heightMm: number) {
  return {
    widthMm: clamp(roundMm(widthMm), 0.1, MAX_PLATE_WIDTH_MM),
    heightMm: clamp(roundMm(heightMm), 0.1, MAX_PLATE_HEIGHT_MM),
  };
}

/** Width or height typed in the designer. Uses the named plate bounds. */
export function clampDesignerPlateAxis(
  valueMm: number,
  axis: "width" | "height"
) {
  const max = axis === "width" ? MAX_PLATE_WIDTH_MM : MAX_PLATE_HEIGHT_MM;
  return clamp(roundMm(valueMm), MIN_PLATE_MM, max);
}

export function roundMm(value: number, step = 0.1) {
  const factor = Math.round(1 / step);
  return Math.round(value * factor) / factor;
}

export function matchSizePreset(
  widthMm: number,
  heightMm: number
): SizePresetId {
  return nearestSizePreset(widthMm, heightMm).id;
}

/** Preset id when the plate is exactly that size. Custom millimetres return null. */
export function exactSizePreset(
  widthMm: number,
  heightMm: number
): SizePresetId | null {
  return (
    SIZE_PRESETS.find(
      (preset) => preset.widthMm === widthMm && preset.heightMm === heightMm
    )?.id ?? null
  );
}

export function nextObjectId(objects: TextObject[]) {
  const max = objects.reduce((highest, object) => {
    const match = /^text-(\d+)$/.exec(object.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `text-${max + 1}`;
}

export function createTextObject(
  plate: Pick<LabelDesign, "widthMm" | "heightMm">,
  id: string
): TextObject {
  return fitTextToPlate(
    {
      id,
      type: "text",
      text: "TEXT",
      x: plate.widthMm / 2,
      y: plate.heightMm / 2,
      fontSize: MIN_FONT_MM,
      align: "center",
    },
    plate
  );
}

export function textLines(text: string) {
  return text.length > 0 ? text.split("\n") : [""];
}

type PlateSize = Pick<LabelDesign, "widthMm" | "heightMm">;

export function textMetrics(object: TextObject, plate?: PlateSize) {
  const text = plate ? wrapLegendToFit(object.text, plate) : object.text;
  const lines = textLines(text);
  const { kW, kH, ascent } = textFactors(text);
  const width = kW * object.fontSize;
  const height = kH * object.fontSize;
  const left =
    object.align === "center"
      ? object.x - width / 2
      : object.align === "right"
        ? object.x - width
        : object.x;
  const top = object.y - object.fontSize * ascent;
  return { left, top, width, height, lines };
}

export const RESIZE_HANDLES = [
  "nw",
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
] as const;

export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

type Point = { x: number; y: number };

type TextBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

type EdgePins = {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
  centerX?: number;
  centerY?: number;
};

function lineEmWidth(line: string) {
  if (line.length === 0) return CHAR_WIDTH_EM;
  let em = 0;
  for (const char of line) em += GLYPH_EM[char] ?? CHAR_WIDTH_EM;
  return Math.max(em, 0.2);
}

function lineVertical(line: string) {
  return {
    ascent: TALL_RE.test(line) ? GLYPH_ASCENT_TALL_EM : GLYPH_ASCENT_EM,
    descent: DESCENDER_RE.test(line) ? GLYPH_DESCENT_EM : GLYPH_DESCENT_FLAT_EM,
  };
}

function textFactors(text: string) {
  const lines = textLines(text);
  const kW = Math.max(...lines.map(lineEmWidth));
  const first = lineVertical(lines[0] ?? "");
  const last = lineVertical(lines[lines.length - 1] ?? "");
  const kH =
    lines.length <= 1
      ? first.ascent + first.descent
      : first.ascent + (lines.length - 1) * LINE_HEIGHT + last.descent;
  return { kW, kH, ascent: first.ascent };
}

/**
 * Clear border around auto-sized engraving, in millimetres.
 * 7.5% of the width and 9% of the height on each side — about 85% / 82% of the
 * plate — so the legend still fills the label, with a larger margin than a ~90% fit.
 */
export function autoTextInset(plate: PlateSize) {
  return {
    x: clamp(roundMm(plate.widthMm * 0.075), 0.9, 24),
    y: clamp(roundMm(plate.heightMm * 0.09), 0.7, 18),
  };
}

function legendInnerWidth(plate: PlateSize) {
  const inset = autoTextInset(plate);
  return Math.max(plate.widthMm - inset.x * 2, Math.min(plate.widthMm, 0.4));
}

function legendInnerHeight(plate: PlateSize) {
  const inset = autoTextInset(plate);
  return Math.max(plate.heightMm - inset.y * 2, Math.min(plate.heightMm, 0.4));
}

function arrangementScore(lines: string[]) {
  const widths = lines.map(lineEmWidth);
  const maxW = Math.max(...widths);
  const minW = Math.min(...widths);
  return { maxW, balance: maxW - minW };
}

/** Smaller longest line, then the more even set. */
function preferLines(current: string[], candidate: string[]) {
  const next = arrangementScore(candidate);
  const best = arrangementScore(current);
  if (next.maxW < best.maxW - 1e-6) return candidate;
  if (best.maxW < next.maxW - 1e-6) return current;
  if (next.balance < best.balance - 1e-6) return candidate;
  return current;
}

/** Indexes of spaces and hyphens. The break character is not kept on either line. */
function delimiterIndexes(text: string) {
  const indexes: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === " " || char === "-") indexes.push(index);
  }
  return indexes;
}

function linesAtBreaks(text: string, breaks: number[]): string[] | null {
  const parts: string[] = [];
  let start = 0;
  for (const index of breaks) {
    const piece = text.slice(start, index).trim();
    if (!piece) return null;
    parts.push(piece);
    start = index + 1;
  }
  const tail = text.slice(start).trim();
  if (!tail) return null;
  parts.push(tail);
  return parts;
}

function arrangements(text: string, lineCount: 2 | 3) {
  const points = delimiterIndexes(text);
  const found: string[][] = [];
  if (lineCount === 2) {
    for (const index of points) {
      const lines = linesAtBreaks(text, [index]);
      if (lines) found.push(lines);
    }
    return found;
  }
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const lines = linesAtBreaks(text, [points[first], points[second]]);
      if (lines) found.push(lines);
    }
  }
  return found;
}

function linesFitInset(lines: string[], plate: PlateSize) {
  const { maxW } = arrangementScore(lines);
  if (maxW * MIN_FONT_MM > legendInnerWidth(plate) + 1e-4) return false;
  const { kH } = textFactors(lines.join("\n"));
  return kH * MIN_FONT_MM <= legendInnerHeight(plate) + 1e-4;
}

function narrowest(options: string[][], plate: PlateSize) {
  const fittingHeight = options.filter((lines) => {
    const { kH } = textFactors(lines.join("\n"));
    return kH * MIN_FONT_MM <= legendInnerHeight(plate) + 1e-4;
  });
  const pool = fittingHeight.length > 0 ? fittingHeight : options;
  return pool.reduce((best, lines) => preferLines(best, lines));
}

/**
 * Wrap on a space or hyphen when one line cannot sit inside the plate inset
 * at {@link MIN_FONT_MM}. Never cuts a word. A two-line break is preferred;
 * a third line is used when every two-line break is still wider than the inset
 * (a two-line split can miss by a fraction of a millimetre and must not fall
 * through to a mid-word cut). If no word-boundary wrap fits, the narrowest
 * two- or three-line break is kept and fitting clamps to the minimum font.
 * A legend with no space or hyphen stays one line. A newline already in the
 * legend is a manual break and stays as typed.
 * Example: `ADMIN-AC7-THEATRE` on a 20×10 becomes `ADMIN-AC7` / `THEATRE`.
 */
export function wrapLegendToFit(text: string, plate: PlateSize): string {
  if (text.includes("\n") || text.trim().length === 0) return text;
  if (lineEmWidth(text) * MIN_FONT_MM <= legendInnerWidth(plate) + 1e-4) return text;

  for (const count of [2, 3] as const) {
    const fitting = arrangements(text, count).filter((lines) => linesFitInset(lines, plate));
    if (fitting.length > 0) {
      return fitting.reduce((best, lines) => preferLines(best, lines)).join("\n");
    }
  }

  const fallback = [...arrangements(text, 2), ...arrangements(text, 3)];
  if (fallback.length === 0) return text;
  return narrowest(fallback, plate).join("\n");
}

/**
 * Largest type that fills the plate on the limiting axis, with that inset,
 * then centred (or pinned to that inset when the legend is left or right aligned).
 */
export function fitTextToPlate(object: TextObject, plate: PlateSize): TextObject {
  const text = wrapLegendToFit(object.text, plate);
  const { kW, kH, ascent } = textFactors(text);
  const inset = autoTextInset(plate);
  const innerW = Math.max(plate.widthMm - inset.x * 2, Math.min(plate.widthMm, 0.4));
  const innerH = Math.max(plate.heightMm - inset.y * 2, Math.min(plate.heightMm, 0.4));
  const fit = Math.min(innerW / kW, innerH / kH);
  const fontSize = clamp(
    floorMm(Number.isFinite(fit) ? fit : MIN_FONT_MM),
    MIN_FONT_MM,
    maxFontForPlate(text, plate)
  );
  const height = kH * fontSize;
  const x =
    object.align === "left"
      ? inset.x
      : object.align === "right"
        ? plate.widthMm - inset.x
        : plate.widthMm / 2;
  const y = (plate.heightMm - height) / 2 + ascent * fontSize;
  return clampObjectToPlate(
    { ...object, fontSize, x: roundMm(x), y: roundMm(y) },
    plate
  );
}

/**
 * Largest 0.1 mm em that fits this legend inside the usual inset, after the
 * same word-boundary wrap the designer uses. This is not raised to
 * {@link MIN_FONT_MM}: a long legend may only fit smaller than that floor.
 */
export function legendFitFontMm(text: string, plate: PlateSize) {
  const wrapped = wrapLegendToFit(text, plate);
  const { kW, kH } = textFactors(wrapped);
  const fit = Math.min(legendInnerWidth(plate) / kW, legendInnerHeight(plate) / kH);
  if (!Number.isFinite(fit) || fit <= 0) return 0.1;
  return Math.min(MAX_FONT_MM, floorMm(Math.max(fit, 0.1)));
}

export function capHeightMm(fontSize: number) {
  return Math.round(fontSize * CAP_HEIGHT_EM * 1000) / 1000;
}

/** Collapse baked line breaks so a new size can wrap the legend again. */
export function singleLineLegend(text: string) {
  return text.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function linesFitAtFont(lines: string[], plate: PlateSize, fontSize: number) {
  const width = Math.max(...lines.map(lineEmWidth));
  if (width * fontSize > legendInnerWidth(plate) + 1e-4) return false;
  const { kH } = textFactors(lines.join("\n"));
  return kH * fontSize <= legendInnerHeight(plate) + 1e-4;
}

export type FixedLegendLayout = {
  text: string;
  lines: string[];
  fits: boolean;
  fontSize: number;
  /** Gap from the centred glyph box to the inset. Negative when the legend overflows. */
  clearanceMm: number;
  horizontalClearanceMm: number;
  verticalClearanceMm: number;
};

/**
 * Wrap a legend so it fits at one exact em size. One line is preferred, then
 * two, then three, on spaces and hyphens only. The size is never reduced.
 */
export function layoutLegendAtFont(text: string, plate: PlateSize, fontSize: number): FixedLegendLayout {
  const source = singleLineLegend(text);
  const choose = (lines: string[], fits: boolean): FixedLegendLayout => {
    const { kW, kH } = textFactors(lines.join("\n"));
    const horizontal = (legendInnerWidth(plate) - kW * fontSize) / 2;
    const vertical = (legendInnerHeight(plate) - kH * fontSize) / 2;
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return {
      text: lines.join("\n"),
      lines,
      fits,
      fontSize,
      horizontalClearanceMm: round(horizontal),
      verticalClearanceMm: round(vertical),
      clearanceMm: round(Math.min(horizontal, vertical)),
    };
  };
  if (!source) return choose([""], true);
  if (linesFitAtFont([source], plate, fontSize)) return choose([source], true);
  for (const count of [2, 3] as const) {
    const fitting = arrangements(source, count).filter((lines) => linesFitAtFont(lines, plate, fontSize));
    if (fitting.length > 0) {
      return choose(fitting.reduce((best, lines) => preferLines(best, lines)), true);
    }
  }
  const fallback = [...arrangements(source, 2), ...arrangements(source, 3)];
  if (fallback.length === 0) return choose([source], linesFitAtFont([source], plate, fontSize));
  const fittingHeight = fallback.filter((lines) => {
    const { kH } = textFactors(lines.join("\n"));
    return kH * fontSize <= legendInnerHeight(plate) + 1e-4;
  });
  const pool = fittingHeight.length > 0 ? fittingHeight : fallback;
  const chosen = pool.reduce((best, lines) => preferLines(best, lines));
  return choose(chosen, linesFitAtFont(chosen, plate, fontSize));
}

/** Largest 0.1 mm size at which every legend fits, or null when none of the steps fit. */
export function largestFixedTextMm(
  plates: Array<{ widthMm: number; heightMm: number; text: string }>
) {
  for (let tenths = 200; tenths >= 5; tenths -= 1) {
    const fontSize = tenths / 10;
    const fits = plates.every((plate) => layoutLegendAtFont(plate.text, plate, fontSize).fits);
    if (fits) return fontSize;
  }
  return null;
}

/** Place a legend at an exact em size, wrapped and centred inside the inset. */
export function placeLegendAtSize<T extends Pick<TextObject, "text" | "x" | "y" | "fontSize" | "align">>(
  object: T,
  plate: PlateSize,
  fontSize: number
): T {
  const text = wrapLegendToFit(object.text, plate);
  const { kH, ascent } = textFactors(text);
  const inset = autoTextInset(plate);
  const height = kH * fontSize;
  const x =
    object.align === "left"
      ? inset.x
      : object.align === "right"
        ? plate.widthMm - inset.x
        : plate.widthMm / 2;
  const y = (plate.heightMm - height) / 2 + ascent * fontSize;
  return {
    ...object,
    text,
    fontSize,
    x: roundMm(x),
    y: roundMm(y),
  };
}

export type UniformTextGroup = {
  widthMm: number;
  heightMm: number;
  fontSize: number;
  capHeightMm: number;
  /** Legends whose own fit equals the shared size. */
  limitingTexts: string[];
};

function plateSizeKey(widthMm: number, heightMm: number) {
  return `${Math.round(widthMm * 10)}x${Math.round(heightMm * 10)}`;
}

/** One shared em for every plate of the same width and height. */
export function uniformTextGroups(
  plates: Array<{ widthMm: number; heightMm: number; text: string }>
): UniformTextGroup[] {
  const groups = new Map<string, { widthMm: number; heightMm: number; fits: Array<{ text: string; fontSize: number }> }>();
  for (const plate of plates) {
    const key = plateSizeKey(plate.widthMm, plate.heightMm);
    const fontSize = legendFitFontMm(plate.text, plate);
    const existing = groups.get(key);
    if (existing) {
      existing.fits.push({ text: plate.text, fontSize });
    } else {
      groups.set(key, {
        widthMm: plate.widthMm,
        heightMm: plate.heightMm,
        fits: [{ text: plate.text, fontSize }],
      });
    }
  }
  return [...groups.values()].map((group) => {
    const fontSize = Math.min(...group.fits.map((fit) => fit.fontSize));
    return {
      widthMm: group.widthMm,
      heightMm: group.heightMm,
      fontSize,
      capHeightMm: capHeightMm(fontSize),
      limitingTexts: group.fits.filter((fit) => fit.fontSize === fontSize).map((fit) => fit.text),
    };
  });
}

type UniformPlate = {
  widthMm: number;
  heightMm: number;
  text: string;
  uniformTextSize?: boolean;
  /** Set when every plate in the order uses this exact em size. */
  uniformTextMm?: number;
  objects: Array<Pick<TextObject, "text" | "x" | "y" | "fontSize" | "align">>;
};

/** Every plate of one size gets the largest em that still fits every legend of that size. */
export function applyUniformTextSize<T extends UniformPlate>(plates: T[]): T[] {
  const groups = uniformTextGroups(
    plates.flatMap((plate) => {
      const texts = plate.objects.length > 0 ? plate.objects.map((object) => object.text) : [plate.text];
      return texts.map((text) => ({ widthMm: plate.widthMm, heightMm: plate.heightMm, text }));
    })
  );
  const fonts = new Map(
    groups.map((group) => [plateSizeKey(group.widthMm, group.heightMm), group.fontSize])
  );
  return plates.map((plate) => {
    const fontSize = fonts.get(plateSizeKey(plate.widthMm, plate.heightMm));
    if (fontSize == null) return { ...plate, uniformTextSize: true };
    const objects = plate.objects.map((object) =>
      placeLegendAtSize({ ...object, text: singleLineLegend(object.text) }, plate, fontSize)
    );
    const text = objects
      .map((object) => object.text.trim())
      .filter(Boolean)
      .join("\n");
    const next = { ...plate, uniformTextSize: true, objects, text: text || plate.text };
    delete next.uniformTextMm;
    return next;
  });
}

/** One em size for every plate in the order. Legends wrap up to three lines and are not shrunk. */
export function applyFixedTextSize<T extends UniformPlate>(plates: T[], fontSize: number): T[] {
  return plates.map((plate) => {
    const objects = plate.objects.map((object) => {
      const laid = layoutLegendAtFont(object.text, plate, fontSize);
      const { kH, ascent } = textFactors(laid.text);
      const inset = autoTextInset(plate);
      const height = kH * fontSize;
      const x =
        object.align === "left"
          ? inset.x
          : object.align === "right"
            ? plate.widthMm - inset.x
            : plate.widthMm / 2;
      const y = (plate.heightMm - height) / 2 + ascent * fontSize;
      return {
        ...object,
        text: laid.text,
        fontSize,
        x: roundMm(x),
        y: roundMm(y),
      };
    });
    const text = objects
      .map((object) => object.text.trim())
      .filter(Boolean)
      .join("\n");
    const next = {
      ...plate,
      uniformTextMm: fontSize,
      objects,
      text: text || plate.text,
    };
    delete next.uniformTextSize;
    return next;
  });
}

/** Put each legend back on its own fit and clear the shared-size mark. */
export function restoreIndividualLegendFit<T extends UniformPlate>(plates: T[]): T[] {
  return plates.map((plate) => {
    const objects = plate.objects.map((object) => {
      const fitted = fitTextToPlate({ ...object, id: "text-1", type: "text" }, plate);
      return {
        ...object,
        text: fitted.text,
        x: fitted.x,
        y: fitted.y,
        fontSize: fitted.fontSize,
      };
    });
    const text = objects
      .map((object) => object.text.trim())
      .filter(Boolean)
      .join("\n");
    const rest = { ...plate };
    delete rest.uniformTextSize;
    delete rest.uniformTextMm;
    return { ...rest, objects, text: text || plate.text };
  });
}

/**
 * Production and nest engrave. A legend that already fits, including a manual
 * line break, keeps its saved anchor. A single line that spills past the inset
 * is wrapped and refitted the same way as the designer.
 */
export function engraveLayout<
  T extends Pick<TextObject, "id" | "text" | "x" | "y" | "fontSize" | "align">,
>(object: T, plate: PlateSize): T {
  const atFont = layoutLegendAtFont(singleLineLegend(object.text), plate, object.fontSize);
  if (atFont.text === object.text) return object;
  const text = wrapLegendToFit(object.text, plate);
  if (text === object.text) return object;
  const fitted = fitTextToPlate(
    {
      id: object.id,
      type: "text",
      text: object.text,
      x: object.x,
      y: object.y,
      fontSize: object.fontSize,
      align: object.align,
    },
    plate
  );
  return {
    ...object,
    text,
    x: fitted.x,
    y: fitted.y,
    fontSize: fitted.fontSize,
  };
}

// Fitted once fitTextToPlate exists, so the opening legend matches every other plate.
DEFAULT_DESIGN.objects = [
  fitTextToPlate(
    {
      id: "text-1",
      type: "text",
      text: "MAIN",
      x: DEFAULT_PRESET.widthMm / 2,
      y: DEFAULT_PRESET.heightMm / 2,
      fontSize: MIN_FONT_MM,
      align: "center",
    },
    DEFAULT_PRESET
  ),
];

function textBox(object: TextObject, plate?: PlateSize): TextBox {
  const metrics = textMetrics(object, plate);
  return {
    left: metrics.left,
    top: metrics.top,
    width: metrics.width,
    height: metrics.height,
    right: metrics.left + metrics.width,
    bottom: metrics.top + metrics.height,
    centerX: metrics.left + metrics.width / 2,
    centerY: metrics.top + metrics.height / 2,
  };
}

/** Largest 0.1 mm font that still fits the legend box on the plate. */
export function maxFontForPlate(text: string, plate: PlateSize) {
  const { kW, kH } = textFactors(wrapLegendToFit(text, plate));
  const fit = Math.min(plate.widthMm / kW, plate.heightMm / kH);
  if (!Number.isFinite(fit) || fit <= MIN_FONT_MM) return MIN_FONT_MM;
  return clamp(floorMm(Math.min(MAX_FONT_MM, fit)), MIN_FONT_MM, MAX_FONT_MM);
}

function floorMm(value: number, step = 0.1) {
  const floored = Math.floor(value / step + 1e-6);
  return Math.round(floored * step * 1000) / 1000;
}

function shiftToFit(origin: number, size: number, limit: number) {
  const end = origin + size;
  const eps = 1e-4;
  if (size <= limit + eps) {
    if (origin < -eps) return -origin;
    if (end > limit + eps) return limit - end;
    return 0;
  }
  const minOrigin = limit - size;
  if (origin < minOrigin - eps) return minOrigin - origin;
  if (origin > eps) return -origin;
  return 0;
}

function containTextOnPlate(object: TextObject, plate: PlateSize): TextObject {
  const metrics = textMetrics(object, plate);
  const x = object.x + shiftToFit(metrics.left, metrics.width, plate.widthMm);
  const y = object.y + shiftToFit(metrics.top, metrics.height, plate.heightMm);
  if (x === object.x && y === object.y) return object;
  return { ...object, x, y };
}

export function clampObjectToPlate(object: TextObject, plate: PlateSize): TextObject {
  const fontSize = clamp(
    roundMm(object.fontSize),
    MIN_FONT_MM,
    maxFontForPlate(object.text, plate)
  );
  const rounded = containTextOnPlate(
    { ...object, fontSize, x: roundMm(object.x), y: roundMm(object.y) },
    plate
  );
  return containTextOnPlate(
    { ...rounded, x: roundMm(rounded.x), y: roundMm(rounded.y) },
    plate
  );
}

function anchorPoint(handle: ResizeHandle, box: TextBox): Point {
  switch (handle) {
    case "nw":
      return { x: box.right, y: box.bottom };
    case "n":
      return { x: box.centerX, y: box.bottom };
    case "ne":
      return { x: box.left, y: box.bottom };
    case "e":
      return { x: box.left, y: box.centerY };
    case "se":
      return { x: box.left, y: box.top };
    case "s":
      return { x: box.centerX, y: box.top };
    case "sw":
      return { x: box.right, y: box.top };
    case "w":
      return { x: box.right, y: box.centerY };
  }
}

function pinsFor(handle: ResizeHandle, box: TextBox): EdgePins {
  switch (handle) {
    case "nw":
      return { right: box.right, bottom: box.bottom };
    case "n":
      return { centerX: box.centerX, bottom: box.bottom };
    case "ne":
      return { left: box.left, bottom: box.bottom };
    case "e":
      return { left: box.left, centerY: box.centerY };
    case "se":
      return { left: box.left, top: box.top };
    case "s":
      return { centerX: box.centerX, top: box.top };
    case "sw":
      return { right: box.right, top: box.top };
    case "w":
      return { right: box.right, centerY: box.centerY };
  }
}

function maxFontForPins(pins: EdgePins, plate: PlateSize, kW: number, kH: number) {
  let max = MAX_FONT_MM;

  if (pins.centerX !== undefined) {
    const half = Math.min(pins.centerX, plate.widthMm - pins.centerX);
    max = Math.min(max, (half * 2) / kW);
  } else if (pins.left !== undefined) {
    max = Math.min(max, (plate.widthMm - pins.left) / kW);
  } else if (pins.right !== undefined) {
    max = Math.min(max, pins.right / kW);
  }

  if (pins.centerY !== undefined) {
    const half = Math.min(pins.centerY, plate.heightMm - pins.centerY);
    max = Math.min(max, (half * 2) / kH);
  } else if (pins.top !== undefined) {
    max = Math.min(max, (plate.heightMm - pins.top) / kH);
  } else if (pins.bottom !== undefined) {
    max = Math.min(max, pins.bottom / kH);
  }

  if (!Number.isFinite(max) || max <= MIN_FONT_MM) return MIN_FONT_MM;
  return clamp(floorMm(Math.min(MAX_FONT_MM, max)), MIN_FONT_MM, MAX_FONT_MM);
}

function spanRatio(next: number, start: number) {
  if (start <= 0.4) return next <= 0 ? 0 : next / Math.max(start, 0.4);
  return next / start;
}

function scaleFromPointer(
  handle: ResizeHandle,
  box: TextBox,
  pointer: Point,
  origin: Point
) {
  const anchor = anchorPoint(handle, box);
  if (handle === "e" || handle === "w") {
    const sign = handle === "e" ? 1 : -1;
    return spanRatio(sign * (pointer.x - anchor.x), sign * (origin.x - anchor.x));
  }
  if (handle === "n" || handle === "s") {
    const sign = handle === "s" ? 1 : -1;
    return spanRatio(sign * (pointer.y - anchor.y), sign * (origin.y - anchor.y));
  }

  const sdx = origin.x - anchor.x;
  const sdy = origin.y - anchor.y;
  const dx = pointer.x - anchor.x;
  const dy = pointer.y - anchor.y;
  const startLen = Math.hypot(sdx, sdy);
  if (startLen < 0.4) return 1;
  if (dx * sdx + dy * sdy <= 0) return 0;
  return Math.hypot(dx, dy) / startLen;
}

function placeWithPins(
  object: TextObject,
  pins: EdgePins,
  kW: number,
  kH: number,
  plate: PlateSize
): TextObject {
  const fontSize = object.fontSize;
  const width = kW * fontSize;
  const { ascent } = textFactors(wrapLegendToFit(object.text, plate));
  let x = object.x;
  let y = object.y;

  if (pins.centerX !== undefined) {
    if (object.align === "center") x = pins.centerX;
    else if (object.align === "left") x = pins.centerX - width / 2;
    else x = pins.centerX + width / 2;
  } else if (pins.left !== undefined) {
    if (object.align === "center") x = pins.left + width / 2;
    else if (object.align === "left") x = pins.left;
    else x = pins.left + width;
  } else if (pins.right !== undefined) {
    if (object.align === "center") x = pins.right - width / 2;
    else if (object.align === "left") x = pins.right - width;
    else x = pins.right;
  }

  if (pins.centerY !== undefined) {
    y = pins.centerY - fontSize * (kH / 2 - ascent);
  } else if (pins.top !== undefined) {
    y = pins.top + fontSize * ascent;
  } else if (pins.bottom !== undefined) {
    y = pins.bottom - fontSize * (kH - ascent);
  }

  return { ...object, x, y };
}

export function resizeHandlePoints(object: TextObject, plate?: PlateSize) {
  const box = textBox(object, plate);
  return [
    { id: "nw" as const, x: box.left, y: box.top },
    { id: "n" as const, x: box.centerX, y: box.top },
    { id: "ne" as const, x: box.right, y: box.top },
    { id: "e" as const, x: box.right, y: box.centerY },
    { id: "se" as const, x: box.right, y: box.bottom },
    { id: "s" as const, x: box.centerX, y: box.bottom },
    { id: "sw" as const, x: box.left, y: box.bottom },
    { id: "w" as const, x: box.left, y: box.centerY },
  ];
}

/**
 * Scale `start` from a resize handle. `origin` is the pointer position when
 * the drag began, so the font does not jump if the grab is off the handle centre.
 */
export function resizeTextObject(
  start: TextObject,
  plate: PlateSize,
  handle: ResizeHandle,
  pointer: Point,
  origin: Point
): TextObject {
  const box = textBox(start, plate);
  const { kW, kH } = textFactors(wrapLegendToFit(start.text, plate));
  const scale = scaleFromPointer(handle, box, pointer, origin);
  const fontSize = clamp(
    roundMm(start.fontSize * Math.max(0, scale)),
    MIN_FONT_MM,
    maxFontForPins(pinsFor(handle, box), plate, kW, kH)
  );
  const placed = placeWithPins(
    { ...start, fontSize },
    pinsFor(handle, box),
    kW,
    kH,
    plate
  );
  return clampObjectToPlate(placed, plate);
}

export function shrinkTextToPlate(
  object: TextObject,
  plate: Pick<LabelDesign, "widthMm" | "heightMm">
): TextObject {
  const fitted = fitTextToPlate(object, plate);
  const reflowed = wrapLegendToFit(object.text, plate) !== object.text;
  if (reflowed || fitted.fontSize + 0.05 < object.fontSize) return fitted;
  return clampObjectToPlate(object, plate);
}

export function applyPlateSize(
  design: LabelDesign,
  widthMm: number,
  heightMm: number
): LabelDesign {
  const size = clampFreeformPlateSize(widthMm, heightMm);
  if (size.widthMm === design.widthMm && size.heightMm === design.heightMm) {
    return design;
  }
  if (design.objects.length <= 1) {
    return {
      ...design,
      ...size,
      objects: design.objects.map((object) => fitTextToPlate(object, size)),
    };
  }
  const sx = size.widthMm / design.widthMm;
  const sy = size.heightMm / design.heightMm;
  const scale = Math.min(sx, sy);
  return {
    ...design,
    ...size,
    objects: design.objects.map((object) =>
      shrinkTextToPlate(
        {
          ...object,
          fontSize: object.fontSize * scale,
          x: object.x * sx,
          y: object.y * sy,
        },
        size
      )
    ),
  };
}

export function colourPairOf(design: LabelDesign) {
  return COLOUR_PAIRS[design.colourPair];
}

export function designSummary(design: LabelDesign) {
  const colours = colourPairOf(design);
  return `${design.widthMm} × ${design.heightMm} mm · ${colours.label} · square corners${
    design.adhesive3m ? " · 3M adhesive" : ""
  }`;
}

export function plateFilename(design: LabelDesign) {
  return `trafflabels-${design.widthMm}x${design.heightMm}-${design.colourPair}.svg`;
}

export function newLineId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLegendDesign(
  colourPair: ColourPairId,
  widthMm: number,
  heightMm: number,
  text: string
): LabelDesign {
  const size = { widthMm, heightMm };
  return {
    version: DESIGN_VERSION,
    ...size,
    colourPair,
    adhesive3m: false,
    objects: [
      fitTextToPlate(
        {
          id: "text-1",
          type: "text",
          text,
          x: widthMm / 2,
          y: heightMm / 2,
          fontSize: MIN_FONT_MM,
          align: "center",
        },
        size
      ),
    ],
  };
}

export function createOrderLine(design: LabelDesign, qty = 1): OrderLine {
  return {
    id: newLineId(),
    qty: clamp(Math.round(qty || 1), 1, 999),
    design,
    svg: serializeLightBurnSvg(design),
  };
}

export function textAnchor(align: TextAlign) {
  if (align === "center") return "middle";
  if (align === "right") return "end";
  return "start";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serializeTextElement(object: TextObject, fill: string, plate: PlateSize) {
  const laid = engraveLayout(object, plate);
  const lines = textLines(laid.text);
  const step = laid.fontSize * LINE_HEIGHT;
  // Separate <text> per line with absolute y: LightBurn ignores tspan dy.
  return lines
    .map((line, index) => {
      const y = Math.round((laid.y + index * step) * 1000) / 1000;
      const id = lines.length > 1 ? `engrave-${laid.id}-line${index + 1}` : `engrave-${laid.id}`;
      return `<text id="${escapeXml(id)}" x="${laid.x}" y="${y}" fill="${fill}" font-family="${ENGRAVE_FONT_FAMILY}" font-size="${laid.fontSize}" font-weight="${ENGRAVE_FONT_WEIGHT}" text-anchor="${textAnchor(laid.align)}">${escapeXml(line || " ")}</text>`;
    })
    .join("");
}

export function serializeDesignJson(design: LabelDesign) {
  return {
    version: DESIGN_VERSION,
    product: "TraffLabels",
    plate: {
      widthMm: design.widthMm,
      heightMm: design.heightMm,
      colourPair: design.colourPair,
      face: colourPairOf(design).face,
      core: colourPairOf(design).core,
      adhesive3m: design.adhesive3m,
      corners: "square" as const,
    },
    objects: design.objects,
  };
}

export function serializeLightBurnSvg(design: LabelDesign) {
  const colours = colourPairOf(design);
  const texts = design.objects
    .map((object) => serializeTextElement(object, "#FF0000", design))
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${design.widthMm}mm" height="${design.heightMm}mm" viewBox="0 0 ${design.widthMm} ${design.heightMm}">
  <!-- TraffLabels v1 · LightBurn handoff · 1 SVG unit = 1 mm · square corners only -->
  <!-- cut (#000000 stroke): plate outline -->
  <!-- engrave (#FF0000 fill): legend text, Arial weight 400 -->
  <!-- guide (#0000FF stroke): same outline for nesting reference; hide if unused -->
  <!-- face ${colours.faceLabel} ${colours.face} / core ${colours.coreLabel} ${colours.core} · 3M adhesive: ${design.adhesive3m ? "yes" : "no"} -->
  <metadata>
    ${escapeXml(JSON.stringify(serializeDesignJson(design)))}
  </metadata>
  <g id="cut" inkscape:groupmode="layer" inkscape:label="cut" data-layer="cut">
    <rect x="0" y="0" width="${design.widthMm}" height="${design.heightMm}" rx="0" ry="0" fill="none" stroke="#000000" stroke-width="0.1"/>
  </g>
  <g id="guide" inkscape:groupmode="layer" inkscape:label="guide" data-layer="guide">
    <rect x="0" y="0" width="${design.widthMm}" height="${design.heightMm}" rx="0" ry="0" fill="none" stroke="#0000FF" stroke-width="0.05"/>
  </g>
  <g id="engrave" inkscape:groupmode="layer" inkscape:label="engrave" data-layer="engrave">
    ${texts}
  </g>
</svg>
`;
}

export function downloadSvg(svg: string, filename: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isColourPairId(value: unknown): value is ColourPairId {
  return typeof value === "string" && value in COLOUR_PAIRS;
}

function isTextAlign(value: unknown): value is TextAlign {
  return value === "left" || value === "center" || value === "right";
}

function parseTextObject(value: unknown): TextObject | null {
  if (!value || typeof value !== "object") return null;
  const object = value as Partial<TextObject>;
  if (typeof object.id !== "string" || typeof object.text !== "string") {
    return null;
  }
  if (
    typeof object.x !== "number" ||
    typeof object.y !== "number" ||
    typeof object.fontSize !== "number" ||
    !isTextAlign(object.align)
  ) {
    return null;
  }
  return {
    id: object.id,
    type: "text",
    text: object.text,
    x: object.x,
    y: object.y,
    fontSize: object.fontSize,
    align: object.align,
  };
}

export function parseDesign(
  value: unknown,
  options?: { snapToPreset?: boolean }
): LabelDesign | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<LabelDesign>;
  if (
    typeof draft.widthMm !== "number" ||
    typeof draft.heightMm !== "number" ||
    !isColourPairId(draft.colourPair) ||
    typeof draft.adhesive3m !== "boolean" ||
    !Array.isArray(draft.objects)
  ) {
    return null;
  }
  const objects = draft.objects
    .map(parseTextObject)
    .filter((object): object is TextObject => object !== null);
  // Snap only when asked. Saved plates and CSV rows keep exact millimetres.
  const size =
    options?.snapToPreset === true
      ? clampPlateSize(draft.widthMm, draft.heightMm)
      : clampFreeformPlateSize(draft.widthMm, draft.heightMm);
  return {
    version: DESIGN_VERSION,
    ...size,
    colourPair: draft.colourPair,
    adhesive3m: draft.adhesive3m,
    objects: objects.map((object) => shrinkTextToPlate(object, size)),
  };
}

export const DESIGN_STORAGE_KEY = "trafflabels.design.v1";
export const ORDER_STORAGE_KEY = "trafflabels.order.v1";
export const UNIFORM_TEXT_STORAGE_KEY = "trafflabels.uniform-text.v1";
export const UNIFORM_TEXT_MM_STORAGE_KEY = "trafflabels.uniform-text-mm.v1";

/**
 * Designer canvas load, including CSV “Open in designer”.
 * Exact millimetres — do not snap to SIZE_PRESETS.
 */
export function parseStoredDesign(value: unknown): LabelDesign {
  return parseDesign(value, { snapToPreset: false }) ?? DEFAULT_DESIGN;
}

export function readStoredDesign(): LabelDesign {
  if (typeof window === "undefined") return DEFAULT_DESIGN;
  try {
    return parseStoredDesign(
      JSON.parse(localStorage.getItem(DESIGN_STORAGE_KEY) ?? "null")
    );
  } catch {
    return DEFAULT_DESIGN;
  }
}

export function readStoredOrderLines(): OrderLine[] {
  if (typeof window === "undefined") return [];
  try {
    return parseOrderLines(
      JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? "null")
    );
  } catch {
    return [];
  }
}

export function parseOrderLines(value: unknown): OrderLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const line = item as Partial<OrderLine>;
    const design = parseDesign(line.design, { snapToPreset: false });
    if (
      !design ||
      typeof line.id !== "string" ||
      typeof line.qty !== "number" ||
      typeof line.svg !== "string"
    ) {
      return [];
    }
    return [
      {
        id: line.id,
        qty: clamp(Math.round(line.qty), 1, 999),
        design,
        svg: line.svg,
      },
    ];
  });
}
