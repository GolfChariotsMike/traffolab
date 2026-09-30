/**
 * Nest TraffLabels plates onto 300 × 200 mm sheets for LightBurn.
 *
 * Plates of one laminate colour and adhesive share a sheet. A plate may be
 * turned 90° clockwise when that uses fewer sheets, or when that is the only
 * orientation that fits the material. Engraving stays in plate coordinates
 * inside a group transform, so the legend turns with the cut rectangle.
 *
 * Cuts are open red paths. Edges are unioned, so two plates that meet share
 * one line instead of two stacked strokes. There is no kerf gap: neighbours
 * sit flush and the shared boundary is the single centerline.
 */

import type { StoredPlate } from "@/lib/orders";
import {
  CUT_STROKE,
  ENGRAVE_FILL,
  LIGHTBURN_SVG_DPI,
  plateCopyCount,
  serializeEngraveText,
} from "@/lib/production-svg";

export const SHEET_WIDTH_MM = 300;
export const SHEET_HEIGHT_MM = 200;

const UNITS_PER_MM = 1000;
const SHEET_W_U = SHEET_WIDTH_MM * UNITS_PER_MM;
const SHEET_H_U = SHEET_HEIGHT_MM * UNITS_PER_MM;

export type Rotation = 0 | 90;

export type NestPlacement = {
  xMm: number;
  yMm: number;
  /** Cut footprint. Swapped from the ordered size when rotation is 90. */
  widthMm: number;
  heightMm: number;
  rotation: Rotation;
  plate: StoredPlate;
  lineIndex: number;
  /** 1-based copy of this order line. */
  copy: number;
};

export type NestSheet = {
  index: number;
  sheetCount: number;
  colourPair: string;
  colourLabel: string;
  adhesive3m: boolean;
  /** False when the plate fits the file only because it is larger than the material sheet. */
  fitsMaterialSheet: boolean;
  widthMm: number;
  heightMm: number;
  placements: NestPlacement[];
};

export type SkippedPlate = {
  lineIndex: number;
  copy: number;
  widthMm: number;
  heightMm: number;
  text: string;
};

export type NestPlan = {
  sheets: NestSheet[];
  skipped: SkippedPlate[];
};

export type CutSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Item = {
  plate: StoredPlate;
  lineIndex: number;
  copy: number;
  widthU: number;
  heightU: number;
};

type FreeRect = { x: number; y: number; w: number; h: number };

type Placed = {
  item: Item;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: Rotation;
};

type PackResult = {
  sheets: Placed[][];
  oversized: Item[];
};

type PackMode = "none" | "fallback" | "bssf";

type Spot = FreeRect & {
  rotation: Rotation;
  short: number;
  long: number;
};

function mmToU(mm: number) {
  return Math.round(mm * UNITS_PER_MM);
}

function uToMm(units: number) {
  return units / UNITS_PER_MM;
}

export function formatMm(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * UNITS_PER_MM) / UNITS_PER_MM;
  if (Object.is(rounded, -0)) return "0";
  return String(rounded);
}

function slots(widthU: number, heightU: number) {
  if (widthU <= 0 || heightU <= 0) return 0;
  if (widthU > SHEET_W_U || heightU > SHEET_H_U) return 0;
  return Math.floor(SHEET_W_U / widthU) * Math.floor(SHEET_H_U / heightU);
}

function sheetsNeeded(perSheet: number, count: number) {
  if (perSheet <= 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(count / perSheet);
}

function overlaps(a: FreeRect, b: FreeRect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function contains(outer: FreeRect, inner: FreeRect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

function prune(rects: FreeRect[]) {
  const filtered = rects.filter((rect) => rect.w > 0 && rect.h > 0);
  const removed = new Array<boolean>(filtered.length).fill(false);
  for (let i = 0; i < filtered.length; i += 1) {
    for (let j = i + 1; j < filtered.length; j += 1) {
      if (removed[i] || removed[j]) continue;
      if (contains(filtered[j], filtered[i])) removed[i] = true;
      else if (contains(filtered[i], filtered[j])) removed[j] = true;
    }
  }
  return filtered.filter((_, index) => !removed[index]);
}

/** MaxRects split: leftovers stay inside the sheet and do not cover `used`. */
function splitFree(free: FreeRect[], used: FreeRect) {
  const next: FreeRect[] = [];
  for (const rect of free) {
    if (!overlaps(rect, used)) {
      next.push(rect);
      continue;
    }
    const freeX2 = rect.x + rect.w;
    const freeY2 = rect.y + rect.h;
    const usedX2 = used.x + used.w;
    const usedY2 = used.y + used.h;
    if (used.x < freeX2 && usedX2 > rect.x) {
      if (used.y > rect.y && used.y < freeY2) {
        next.push({ x: rect.x, y: rect.y, w: rect.w, h: used.y - rect.y });
      }
      if (usedY2 < freeY2) {
        next.push({ x: rect.x, y: usedY2, w: rect.w, h: freeY2 - usedY2 });
      }
    }
    if (used.y < freeY2 && usedY2 > rect.y) {
      if (used.x > rect.x && used.x < freeX2) {
        next.push({ x: rect.x, y: rect.y, w: used.x - rect.x, h: rect.h });
      }
      if (usedX2 < freeX2) {
        next.push({ x: usedX2, y: rect.y, w: freeX2 - usedX2, h: rect.h });
      }
    }
  }
  return prune(next);
}

function compareSpot(a: Spot, b: Spot, rule: "origin" | "bssf") {
  if (rule === "bssf") {
    return a.short - b.short || a.long - b.long || a.y - b.y || a.x - b.x || a.rotation - b.rotation;
  }
  return a.y - b.y || a.x - b.x || a.short - b.short || a.long - b.long || a.rotation - b.rotation;
}

function searchSpot(
  free: FreeRect[],
  options: Array<{ w: number; h: number; rotation: Rotation }>,
  rule: "origin" | "bssf"
) {
  let best: Spot | null = null;
  for (const rect of free) {
    for (const option of options) {
      if (option.w <= 0 || option.h <= 0) continue;
      if (option.w > rect.w || option.h > rect.h) continue;
      const spot: Spot = {
        x: rect.x,
        y: rect.y,
        w: option.w,
        h: option.h,
        rotation: option.rotation,
        short: Math.min(rect.w - option.w, rect.h - option.h),
        long: Math.max(rect.w - option.w, rect.h - option.h),
      };
      if (!best || compareSpot(spot, best, rule) < 0) best = spot;
    }
  }
  return best;
}

function orientations(item: Item, mode: PackMode) {
  const upright = { w: item.widthU, h: item.heightU, rotation: 0 as Rotation };
  if (mode === "none" || item.widthU === item.heightU) return [upright];
  return [upright, { w: item.heightU, h: item.widthU, rotation: 90 as Rotation }];
}

function findSpot(free: FreeRect[], item: Item, mode: PackMode) {
  const options = orientations(item, mode);
  if (mode === "fallback") {
    return searchSpot(free, [options[0]], "origin") ?? (options[1] ? searchSpot(free, [options[1]], "origin") : null);
  }
  return searchSpot(free, options, mode === "bssf" ? "bssf" : "origin");
}

function compareItems(a: Item, b: Item) {
  const aMax = Math.max(a.widthU, a.heightU);
  const bMax = Math.max(b.widthU, b.heightU);
  return (
    bMax - aMax ||
    Math.min(b.widthU, b.heightU) - Math.min(a.widthU, a.heightU) ||
    b.widthU * b.heightU - a.widthU * a.heightU ||
    a.lineIndex - b.lineIndex ||
    a.copy - b.copy
  );
}

function packMaxRects(items: Item[], mode: PackMode): PackResult {
  let pending = [...items].sort(compareItems);
  const sheets: Placed[][] = [];
  const oversized: Item[] = [];
  while (pending.length > 0) {
    let free: FreeRect[] = [{ x: 0, y: 0, w: SHEET_W_U, h: SHEET_H_U }];
    const placed: Placed[] = [];
    const next: Item[] = [];
    for (const item of pending) {
      const spot = findSpot(free, item, mode);
      if (!spot) {
        next.push(item);
        continue;
      }
      placed.push({ item, x: spot.x, y: spot.y, w: spot.w, h: spot.h, rotation: spot.rotation });
      free = splitFree(free, spot);
    }
    if (placed.length === 0) {
      oversized.push(...pending);
      break;
    }
    sheets.push(placed);
    pending = next;
  }
  return { sheets, oversized };
}

function gridPack(items: Item[], rotation: Rotation): PackResult {
  const placedW = rotation === 90 ? items[0].heightU : items[0].widthU;
  const placedH = rotation === 90 ? items[0].widthU : items[0].heightU;
  const cols = Math.floor(SHEET_W_U / placedW);
  const perSheet = slots(placedW, placedH);
  const sheets: Placed[][] = [];
  for (let start = 0; start < items.length; start += perSheet) {
    const slice = items.slice(start, start + perSheet);
    sheets.push(
      slice.map((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        return {
          item,
          x: col * placedW,
          y: row * placedH,
          w: placedW,
          h: placedH,
          rotation,
        };
      })
    );
  }
  return { sheets, oversized: [] };
}

/** Identical plates use a grid. Rotate only when that needs fewer sheets. */
function packIdentical(items: Item[]): PackResult {
  const widthU = items[0].widthU;
  const heightU = items[0].heightU;
  const perUpright = slots(widthU, heightU);
  const perTurned = widthU === heightU ? perUpright : slots(heightU, widthU);
  const uprightSheets = sheetsNeeded(perUpright, items.length);
  const turnedSheets = sheetsNeeded(perTurned, items.length);
  if (uprightSheets === Number.POSITIVE_INFINITY && turnedSheets === Number.POSITIVE_INFINITY) {
    return { sheets: [], oversized: items };
  }
  const rotation: Rotation = turnedSheets < uprightSheets ? 90 : 0;
  return gridPack(items, rotation);
}

function packKey(result: PackResult): [number, number, number] {
  const rotations = result.sheets.reduce(
    (sum, sheet) => sum + sheet.filter((placed) => placed.rotation === 90).length,
    0
  );
  return [result.oversized.length, result.sheets.length, rotations];
}

function betterPack(candidate: PackResult, current: PackResult) {
  const [oversized, sheets, rotations] = packKey(candidate);
  const [currentOversized, currentSheets, currentRotations] = packKey(current);
  if (oversized !== currentOversized) return oversized < currentOversized;
  if (sheets !== currentSheets) return sheets < currentSheets;
  return rotations < currentRotations;
}

/**
 * Mixed sizes: keep the upright pack unless turning some plates uses fewer
 * sheets or is the only way a plate fits on the material.
 */
function packMixed(items: Item[]): PackResult {
  let best = packMaxRects(items, "none");
  for (const mode of ["fallback", "bssf"] as const) {
    const candidate = packMaxRects(items, mode);
    if (betterPack(candidate, best)) best = candidate;
  }
  return best;
}

function sameSize(items: Item[]) {
  const widthU = items[0].widthU;
  const heightU = items[0].heightU;
  return items.every((item) => item.widthU === widthU && item.heightU === heightU);
}

function toPlacement(placed: Placed): NestPlacement {
  return {
    xMm: uToMm(placed.x),
    yMm: uToMm(placed.y),
    widthMm: uToMm(placed.w),
    heightMm: uToMm(placed.h),
    rotation: placed.rotation,
    plate: placed.item.plate,
    lineIndex: placed.item.lineIndex,
    copy: placed.item.copy,
  };
}

type RawSheet = Omit<NestSheet, "index" | "sheetCount">;

function materialSheet(items: Item[], placements: Placed[]): RawSheet {
  const first = items[0].plate;
  return {
    colourPair: first.colourPair,
    colourLabel: first.colourLabel,
    adhesive3m: first.adhesive3m,
    fitsMaterialSheet: true,
    widthMm: SHEET_WIDTH_MM,
    heightMm: SHEET_HEIGHT_MM,
    placements: placements.map(toPlacement),
  };
}

function oversizeSheet(item: Item): RawSheet {
  return {
    colourPair: item.plate.colourPair,
    colourLabel: item.plate.colourLabel,
    adhesive3m: item.plate.adhesive3m,
    fitsMaterialSheet: false,
    widthMm: item.plate.widthMm,
    heightMm: item.plate.heightMm,
    placements: [
      {
        xMm: 0,
        yMm: 0,
        widthMm: item.plate.widthMm,
        heightMm: item.plate.heightMm,
        rotation: 0,
        plate: item.plate,
        lineIndex: item.lineIndex,
        copy: item.copy,
      },
    ],
  };
}

function packGroup(items: Item[]): RawSheet[] {
  const packed = sameSize(items) ? packIdentical(items) : packMixed(items);
  return [
    ...packed.sheets.map((placements) => materialSheet(items, placements)),
    ...packed.oversized.map(oversizeSheet),
  ];
}

function groupKey(plate: StoredPlate) {
  return `${plate.colourPair}\0${plate.adhesive3m ? "1" : "0"}`;
}

export function nestPlates(plates: StoredPlate[]): NestPlan {
  const groups: Item[][] = [];
  const groupIndex = new Map<string, number>();
  const skipped: SkippedPlate[] = [];

  plates.forEach((plate, lineIndex) => {
    const copies = plateCopyCount(plate.qty);
    const widthU = mmToU(plate.widthMm);
    const heightU = mmToU(plate.heightMm);
    const fitsNumber = Number.isFinite(plate.widthMm) && Number.isFinite(plate.heightMm);
    if (!fitsNumber || widthU <= 0 || heightU <= 0) {
      for (let copy = 1; copy <= copies; copy += 1) {
        skipped.push({
          lineIndex,
          copy,
          widthMm: plate.widthMm,
          heightMm: plate.heightMm,
          text: plate.text,
        });
      }
      return;
    }
    const key = groupKey(plate);
    let index = groupIndex.get(key);
    if (index === undefined) {
      index = groups.length;
      groupIndex.set(key, index);
      groups.push([]);
    }
    for (let copy = 1; copy <= copies; copy += 1) {
      groups[index].push({ plate, lineIndex, copy, widthU, heightU });
    }
  });

  const raw = groups.flatMap(packGroup);
  const sheetCount = raw.length;
  return {
    sheets: raw.map((sheet, index) => ({ ...sheet, index: index + 1, sheetCount })),
    skipped,
  };
}

function unionIntervals(intervals: Array<[number, number]>) {
  const sorted = [...intervals].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (!last || start > last[1]) merged.push([start, end]);
    else if (end > last[1]) last[1] = end;
  }
  return merged;
}

/** One segment per unique cut. Overlapping or abutting collinear edges collapse. */
export function mergePlateCuts(
  rects: Array<{ xMm: number; yMm: number; widthMm: number; heightMm: number }>
): CutSegment[] {
  const horizontal = new Map<number, Array<[number, number]>>();
  const vertical = new Map<number, Array<[number, number]>>();

  for (const rect of rects) {
    const x = mmToU(rect.xMm);
    const y = mmToU(rect.yMm);
    const w = mmToU(rect.widthMm);
    const h = mmToU(rect.heightMm);
    if (w <= 0 || h <= 0) continue;
    const addH = (yPos: number, x1: number, x2: number) => {
      const list = horizontal.get(yPos) ?? [];
      list.push([Math.min(x1, x2), Math.max(x1, x2)]);
      horizontal.set(yPos, list);
    };
    const addV = (xPos: number, y1: number, y2: number) => {
      const list = vertical.get(xPos) ?? [];
      list.push([Math.min(y1, y2), Math.max(y1, y2)]);
      vertical.set(xPos, list);
    };
    addH(y, x, x + w);
    addH(y + h, x, x + w);
    addV(x, y, y + h);
    addV(x + w, y, y + h);
  }

  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const [y, intervals] of horizontal) {
    for (const [x1, x2] of unionIntervals(intervals)) {
      segments.push({ x1, y1: y, x2, y2: y });
    }
  }
  for (const [x, intervals] of vertical) {
    for (const [y1, y2] of unionIntervals(intervals)) {
      segments.push({ x1: x, y1, x2: x, y2 });
    }
  }
  segments.sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1 || a.y2 - b.y2 || a.x2 - b.x2);
  return segments.map((segment) => ({
    x1: uToMm(segment.x1),
    y1: uToMm(segment.y1),
    x2: uToMm(segment.x2),
    y2: uToMm(segment.y2),
  }));
}

/** Clockwise 90°. The legend's anchor stays on the same point of the plate. */
export function mapPlatePoint(xMm: number, yMm: number, placement: NestPlacement) {
  if (placement.rotation === 0) {
    return { xMm: placement.xMm + xMm, yMm: placement.yMm + yMm };
  }
  return {
    xMm: placement.xMm + placement.plate.heightMm - yMm,
    yMm: placement.yMm + xMm,
  };
}

export function plateGroupTransform(placement: NestPlacement) {
  const y = formatMm(placement.yMm);
  if (placement.rotation === 0) return `translate(${formatMm(placement.xMm)}, ${y})`;
  return `translate(${formatMm(placement.xMm + placement.plate.heightMm)}, ${y}) rotate(90)`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function xmlComment(value: string) {
  return value.replaceAll("--", "—").replaceAll("<", "").replaceAll(">", "");
}

function materialLabel(sheet: Pick<NestSheet, "colourLabel" | "adhesive3m">) {
  const colour = sheet.colourLabel.trim() || "Unspecified laminate";
  return sheet.adhesive3m ? `${colour} · 3M adhesive` : colour;
}

function materialSlug(colourPair: string, adhesive3m: boolean, oversize: boolean) {
  const base =
    colourPair
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "laminate";
  return `${base}${adhesive3m ? "-3m" : ""}${oversize ? "-oversize" : ""}`;
}

export function nestSheetFilename(orderNumber: number, sheet: NestSheet) {
  const slug = materialSlug(sheet.colourPair, sheet.adhesive3m, !sheet.fitsMaterialSheet);
  return `trafflabels-${orderNumber}-sheet-${sheet.index}-of-${sheet.sheetCount}-${slug}.svg`;
}

function legendLabel(text: string) {
  const first = text.split("\n")[0]?.trim() ?? "";
  return first || "Untitled plate";
}

export function serializeNestSheetSvg(orderNumber: number, sheet: NestSheet) {
  const title = `Sheet ${sheet.index} of ${sheet.sheetCount}`;
  const material = materialLabel(sheet);
  const engrave = sheet.placements
    .map((placement) => {
      const suffix = `-s${sheet.index}-L${placement.lineIndex + 1}-c${placement.copy}`;
      const texts = placement.plate.objects
        .map((object) => serializeEngraveText(object, suffix))
        .join("\n      ");
      const id = `plate-L${placement.lineIndex + 1}-c${placement.copy}`;
      const body = texts ? `\n      ${texts}\n    ` : "";
      return `    <g id="${escapeXml(id)}" data-rotation="${placement.rotation}" transform="${plateGroupTransform(placement)}">${body}</g>`;
    })
    .join("\n");
  const cuts = mergePlateCuts(sheet.placements)
    .map(
      (segment) =>
        `    <path d="M ${formatMm(segment.x1)} ${formatMm(segment.y1)} L ${formatMm(segment.x2)} ${formatMm(segment.y2)}" fill="none" stroke="${CUT_STROKE}" stroke-width="0.1"/>`
    )
    .join("\n");
  const fitNote = sheet.fitsMaterialSheet
    ? `Material sheet ${SHEET_WIDTH_MM} × ${SHEET_HEIGHT_MM} mm.`
    : `This plate does not fit a ${SHEET_WIDTH_MM} × ${SHEET_HEIGHT_MM} mm sheet in either orientation.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${formatMm(sheet.widthMm)}mm" height="${formatMm(sheet.heightMm)}mm" viewBox="0 0 ${formatMm(sheet.widthMm)} ${formatMm(sheet.heightMm)}" data-sheet="${sheet.index}" data-sheet-count="${sheet.sheetCount}">
  <title>${escapeXml(`${title} — ${material}`)}</title>
  <!-- TraffLabels order ${orderNumber}. ${xmlComment(title)}. 1 user unit = 1 mm. -->
  <!-- ${xmlComment(fitNote)} Laminate (not a laser colour): ${xmlComment(material)} -->
  <!-- LightBurn: if import asks for SVG DPI, use ${LIGHTBURN_SVG_DPI}. -->
  <!-- Black fill ${ENGRAVE_FILL} = engrave. Red stroke ${CUT_STROKE} = cut. -->
  <!-- Shared edges are one open path. Plates sit flush, with no kerf gap. -->
  <!-- When a plate is turned, the group transform turns the legend with the cut. -->
  <g id="engrave" data-layer="engrave">
${engrave}
  </g>
  <g id="cut" data-layer="cut">
${cuts}
  </g>
</svg>
`;
}

function placementRows(placements: NestPlacement[]) {
  const rows: Array<{
    count: number;
    plateWidth: number;
    plateHeight: number;
    placedWidth: number;
    placedHeight: number;
    rotation: Rotation;
    label: string;
  }> = [];
  for (const placement of placements) {
    const label = legendLabel(placement.plate.text);
    const last = rows[rows.length - 1];
    if (
      last &&
      last.plateWidth === placement.plate.widthMm &&
      last.plateHeight === placement.plate.heightMm &&
      last.rotation === placement.rotation &&
      last.label === label
    ) {
      last.count += 1;
      continue;
    }
    rows.push({
      count: 1,
      plateWidth: placement.plate.widthMm,
      plateHeight: placement.plate.heightMm,
      placedWidth: placement.widthMm,
      placedHeight: placement.heightMm,
      rotation: placement.rotation,
      label,
    });
  }
  return rows;
}

export function formatNestSummary(orderNumber: number, plan: NestPlan) {
  const lines = [
    `TraffLabels order ${orderNumber}`,
    `Material sheet: ${SHEET_WIDTH_MM} × ${SHEET_HEIGHT_MM} mm`,
    `A plate is rotated 90° only when that uses fewer sheets, or when that is the only way it fits. The legend rotates with the plate.`,
    `Cut: ${CUT_STROKE} stroke. Shared edges are one line. Plates sit flush.`,
    `Engrave: ${ENGRAVE_FILL} fill, Arial, weight 400.`,
    ``,
  ];
  if (plan.sheets.length === 0) lines.push(`No nested sheets.`, ``);
  for (const sheet of plan.sheets) {
    lines.push(`Sheet ${sheet.index} of ${sheet.sheetCount} — ${materialLabel(sheet)}`);
    if (!sheet.fitsMaterialSheet) {
      lines.push(
        `Does not fit a ${SHEET_WIDTH_MM} × ${SHEET_HEIGHT_MM} mm sheet, even rotated 90°. Cut this file on its own.`
      );
    }
    lines.push(`Plates: ${sheet.placements.length}`);
    for (const row of placementRows(sheet.placements)) {
      const spin =
        row.rotation === 90
          ? `, rotated 90° (cut footprint ${formatMm(row.placedWidth)} × ${formatMm(row.placedHeight)} mm)`
          : ``;
      lines.push(
        `  ${row.count} × ${formatMm(row.plateWidth)} × ${formatMm(row.plateHeight)} mm${spin} — ${row.label}`
      );
    }
    lines.push(``);
  }
  if (plan.skipped.length > 0) {
    lines.push(`Skipped (no positive size):`);
    for (const skip of plan.skipped) {
      lines.push(
        `  Line ${skip.lineIndex + 1}, copy ${skip.copy}: ${skip.widthMm} × ${skip.heightMm} mm — ${legendLabel(skip.text)}`
      );
    }
    lines.push(``);
  }
  lines.push(`Cut the SVGs in sheets/. Files in pieces/ are one plate each, for edits.`);
  lines.push(``);
  return lines.join("\n");
}
