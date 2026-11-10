/**
 * Engrave typefaces and their measured glyph metrics.
 *
 * "arial" is system Arial (the default). Proofs and LightBurn files name
 * that face only, so existing plates keep their approval hashes and still
 * match a Windows machine with Arial installed.
 *
 * "condensed" is Roboto Condensed Regular/Bold, Apache License 2.0, vendored
 * in public/fonts/roboto-condensed/. The browser proof loads it with @font-face.
 * Production SVGs name "Roboto Condensed" the same way Arial plates name Arial;
 * include the TTF from that folder on the LightBurn PC if it is not installed.
 *
 * Metrics were measured from the Regular TTF (unitsPerEm 2048, sCapHeight 1456).
 */

export type EngraveFontFace = "arial" | "condensed";

export function isEngraveFontFace(value: unknown): value is EngraveFontFace {
  return value === "arial" || value === "condensed";
}

export function normalizeEngraveFontFace(value: unknown): EngraveFontFace {
  return value === "condensed" ? "condensed" : "arial";
}

export type EngraveFontMetrics = {
  capHeightEm: number;
  ascentEm: number;
  ascentTallEm: number;
  descentEm: number;
  descentFlatEm: number;
  charWidthEm: number;
  glyphEm: Record<string, number>;
};

/** System Arial Regular, as already used for layout and LightBurn. */
export const ARIAL_FONT_FAMILY = "Arial, Helvetica, sans-serif";

/** CSS/SVG family name; the proof page defines @font-face for this name. */
export const CONDENSED_FONT_FAMILY = "'Roboto Condensed', sans-serif";

export const CONDENSED_FONT_FILES = {
  regular: "/fonts/roboto-condensed/RobotoCondensed-Regular.ttf",
  bold: "/fonts/roboto-condensed/RobotoCondensed-Bold.ttf",
} as const;

/** 1456 / 2048, measured from the vendored Regular TTF. */
export const CONDENSED_CAP_HEIGHT_EM = 1456 / 2048;

const CONDENSED_GLYPH_EM: Record<string, number> = {
    " ": 0.2295,
    "-": 0.248,
    "_": 0.4048,
    ".": 0.2637,
    ",": 0.1968,
    ":": 0.2334,
    ";": 0.2026,
    "/": 0.3711,
    "+": 0.4971,
    "#": 0.5479,
    "&": 0.5439,
    "'": 0.1748,
    "\"": 0.3203,
    "(": 0.314,
    ")": 0.3188,
    "[": 0.2505,
    "]": 0.2505,
    "{": 0.3066,
    "}": 0.3066,
    "|": 0.2441,
    "?": 0.4224,
    "0": 0.4937,
    "1": 0.4937,
    "2": 0.4937,
    "3": 0.4937,
    "4": 0.4937,
    "5": 0.4937,
    "6": 0.4937,
    "7": 0.4937,
    "8": 0.4937,
    "9": 0.4937,
    "A": 0.5767,
    "B": 0.5459,
    "C": 0.5669,
    "D": 0.5708,
    "E": 0.4971,
    "F": 0.481,
    "G": 0.5908,
    "H": 0.6201,
    "I": 0.25,
    "J": 0.4834,
    "K": 0.5454,
    "L": 0.4756,
    "M": 0.7554,
    "N": 0.6196,
    "O": 0.6011,
    "P": 0.5542,
    "Q": 0.6011,
    "R": 0.5308,
    "S": 0.5186,
    "T": 0.5205,
    "U": 0.5615,
    "V": 0.5605,
    "W": 0.7617,
    "X": 0.5513,
    "Y": 0.5249,
    "Z": 0.5229,
    "a": 0.479,
    "b": 0.4932,
    "c": 0.4619,
    "d": 0.4961,
    "e": 0.4688,
    "f": 0.3164,
    "g": 0.4932,
    "h": 0.4829,
    "i": 0.2295,
    "j": 0.2241,
    "k": 0.4507,
    "l": 0.2295,
    "m": 0.7529,
    "n": 0.4844,
    "o": 0.502,
    "p": 0.4932,
    "q": 0.5005,
    "r": 0.3047,
    "s": 0.4561,
    "t": 0.2959,
    "u": 0.4834,
    "v": 0.4277,
    "w": 0.6499,
    "x": 0.439,
    "y": 0.4165,
    "z": 0.439,
};

const CONDENSED_METRICS: EngraveFontMetrics = {
  capHeightEm: CONDENSED_CAP_HEIGHT_EM,
  ascentEm: CONDENSED_CAP_HEIGHT_EM,
  ascentTallEm: 0.80224609375,
  descentEm: 0.20849609375,
  descentFlatEm: 0.02,
  charWidthEm: 0.4412,
  glyphEm: CONDENSED_GLYPH_EM,
};

export { CONDENSED_METRICS };

/** Cap-height fraction for the named face. Arial keeps the historical 0.73. */
export function capHeightEmOf(face?: EngraveFontFace | null) {
  return normalizeEngraveFontFace(face) === "condensed" ? CONDENSED_CAP_HEIGHT_EM : 0.73;
}

export function engraveFontFamily(face?: EngraveFontFace | null) {
  return normalizeEngraveFontFace(face) === "condensed" ? CONDENSED_FONT_FAMILY : ARIAL_FONT_FAMILY;
}

/** Em size that yields the requested cap height for this face, rounded to 0.001 mm. */
export function emForCapHeightMm(capHeightMm: number, face?: EngraveFontFace | null) {
  return Math.round((capHeightMm / capHeightEmOf(face)) * 1000) / 1000;
}
