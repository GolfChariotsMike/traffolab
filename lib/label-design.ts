export const DESIGN_VERSION = 1 as const;

/** Smallest trade preset is 20 × 10 (Mike’s physical sample). */
export const MIN_PLATE_MM = 10;
export const MAX_PLATE_WIDTH_MM = 300;
export const MAX_PLATE_HEIGHT_MM = 200;

export const MIN_FONT_MM = 3;
export const MAX_FONT_MM = 40;

export const LINE_HEIGHT = 1.15;
export const CHAR_WIDTH_EM = 0.62;
export const ENGRAVE_FONT_FAMILY = "Space Grotesk, Arial, sans-serif";

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
  objects: [
    {
      id: "text-1",
      type: "text",
      text: "MAIN",
      x: 10,
      y: 6.8,
      fontSize: 6.5,
      align: "center",
    },
  ],
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
 * Plate sizes are presets only. Older saved designs (and any out-of-range
 * values) snap to the nearest preset by Euclidean distance in millimetres.
 */
export function snapToSizePreset(widthMm: number, heightMm: number) {
  const preset = nearestSizePreset(widthMm, heightMm);
  return { widthMm: preset.widthMm, heightMm: preset.heightMm };
}

export function clampPlateSize(widthMm: number, heightMm: number) {
  const size = clampFreeformPlateSize(widthMm, heightMm);
  return snapToSizePreset(size.widthMm, size.heightMm);
}

/** CSV / order-draft path: keep exact millimetres, only bound the range. */
export function clampFreeformPlateSize(widthMm: number, heightMm: number) {
  return {
    widthMm: clamp(roundMm(widthMm), 0.1, MAX_PLATE_WIDTH_MM),
    heightMm: clamp(roundMm(heightMm), 0.1, MAX_PLATE_HEIGHT_MM),
  };
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
  const fontSize = clamp(roundMm(plate.heightMm * 0.28), MIN_FONT_MM, 18);
  return {
    id,
    type: "text",
    text: "TEXT",
    x: roundMm(plate.widthMm / 2),
    y: roundMm(plate.heightMm / 2 + fontSize * 0.35),
    fontSize,
    align: "center",
  };
}

export function textLines(text: string) {
  return text.length > 0 ? text.split("\n") : [""];
}

export function textMetrics(object: TextObject) {
  const lines = textLines(object.text);
  const maxChars = Math.max(1, ...lines.map((line) => line.length));
  const width = maxChars * object.fontSize * CHAR_WIDTH_EM;
  const height = lines.length * object.fontSize * LINE_HEIGHT;
  const left =
    object.align === "center"
      ? object.x - width / 2
      : object.align === "right"
        ? object.x - width
        : object.x;
  const top = object.y - object.fontSize * 0.82;
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

type PlateSize = Pick<LabelDesign, "widthMm" | "heightMm">;
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

function textFactors(text: string) {
  const lines = textLines(text);
  const maxChars = Math.max(1, ...lines.map((line) => line.length));
  return {
    kW: maxChars * CHAR_WIDTH_EM,
    kH: lines.length * LINE_HEIGHT,
  };
}

function textBox(object: TextObject): TextBox {
  const metrics = textMetrics(object);
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
  const { kW, kH } = textFactors(text);
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
  const metrics = textMetrics(object);
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
  kH: number
): TextObject {
  const fontSize = object.fontSize;
  const width = kW * fontSize;
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
    y = pins.centerY - fontSize * (kH / 2 - 0.82);
  } else if (pins.top !== undefined) {
    y = pins.top + fontSize * 0.82;
  } else if (pins.bottom !== undefined) {
    y = pins.bottom - fontSize * (kH - 0.82);
  }

  return { ...object, x, y };
}

export function resizeHandlePoints(object: TextObject) {
  const box = textBox(object);
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
  const box = textBox(start);
  const { kW, kH } = textFactors(start.text);
  const scale = scaleFromPointer(handle, box, pointer, origin);
  const fontSize = clamp(
    roundMm(start.fontSize * Math.max(0, scale)),
    MIN_FONT_MM,
    maxFontForPins(pinsFor(handle, box), plate, kW, kH)
  );
  const placed = placeWithPins({ ...start, fontSize }, pinsFor(handle, box), kW, kH);
  return clampObjectToPlate(placed, plate);
}

export function shrinkTextToPlate(
  object: TextObject,
  plate: Pick<LabelDesign, "widthMm" | "heightMm">
): TextObject {
  const lines = textLines(object.text);
  const maxChars = Math.max(1, ...lines.map((line) => line.length));
  const widthLimit = (plate.widthMm - 4) / (maxChars * CHAR_WIDTH_EM);
  const heightLimit = (plate.heightMm - 2) / (lines.length * LINE_HEIGHT);
  return clampObjectToPlate(
    {
      ...object,
      fontSize: clamp(
        roundMm(Math.min(object.fontSize, widthLimit, heightLimit)),
        MIN_FONT_MM,
        MAX_FONT_MM
      ),
    },
    plate
  );
}

export function applyPlateSize(
  design: LabelDesign,
  widthMm: number,
  heightMm: number
): LabelDesign {
  const size = clampPlateSize(widthMm, heightMm);
  return {
    ...design,
    ...size,
    objects: design.objects.map((object) => shrinkTextToPlate(object, size)),
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
  const seed = createTextObject(size, "text-1");
  return {
    version: DESIGN_VERSION,
    ...size,
    colourPair,
    adhesive3m: false,
    objects: [shrinkTextToPlate({ ...seed, text }, size)],
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

function serializeTextElement(
  object: TextObject,
  fill: string,
  fontWeight = 600
) {
  const lines = textLines(object.text);
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : roundMm(object.fontSize * LINE_HEIGHT);
      return `<tspan x="${object.x}" dy="${dy}">${escapeXml(line || " ")}</tspan>`;
    })
    .join("");

  return `<text id="engrave-${escapeXml(object.id)}" x="${object.x}" y="${object.y}" fill="${fill}" font-family="${ENGRAVE_FONT_FAMILY}" font-size="${object.fontSize}" font-weight="${fontWeight}" text-anchor="${textAnchor(object.align)}">${tspans}</text>`;
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
    .map((object) => serializeTextElement(object, "#FF0000"))
    .join("\n    ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${design.widthMm}mm" height="${design.heightMm}mm" viewBox="0 0 ${design.widthMm} ${design.heightMm}">
  <!-- TraffLabels v1 · LightBurn handoff · 1 SVG unit = 1 mm · square corners only -->
  <!-- cut (#000000 stroke): plate outline -->
  <!-- engrave (#FF0000 fill): legend text, Space Grotesk / industrial sans -->
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
  const size =
    options?.snapToPreset === false
      ? clampFreeformPlateSize(draft.widthMm, draft.heightMm)
      : clampPlateSize(draft.widthMm, draft.heightMm);
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

export function readStoredDesign(): LabelDesign {
  if (typeof window === "undefined") return DEFAULT_DESIGN;
  try {
    return (
      parseDesign(JSON.parse(localStorage.getItem(DESIGN_STORAGE_KEY) ?? "null")) ??
      DEFAULT_DESIGN
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
