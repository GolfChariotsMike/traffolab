import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { engraveLayout, textMetrics } from "./label-design";
import { buildProductionDownload } from "./production-download";
import {
  SHEET_HEIGHT_MM,
  SHEET_WIDTH_MM,
  formatNestSummary,
  mapPlatePoint,
  mergePlateCuts,
  nestPlates,
  plateGroupTransform,
  serializeNestSheetSvg,
  type CutSegment,
  type NestPlacement,
  type NestSheet,
} from "./sheet-nest";
import { unzipStore } from "./zip";
import type { StoredPlate } from "./orders";

function q(value: number) {
  return Math.round(value * 1000);
}

function plate(
  overrides: Partial<StoredPlate> & Pick<StoredPlate, "widthMm" | "heightMm">
): StoredPlate {
  const text = overrides.text ?? "LABEL";
  return {
    widthMm: overrides.widthMm,
    heightMm: overrides.heightMm,
    qty: overrides.qty ?? 1,
    unitCents: 100,
    lineCents: 100,
    colourPair: overrides.colourPair ?? "yellow-black",
    colourLabel: overrides.colourLabel ?? "Yellow / black",
    adhesive3m: overrides.adhesive3m ?? false,
    text,
    objects: overrides.objects ?? [
      {
        id: "text-1",
        text,
        x: overrides.widthMm / 2,
        y: overrides.heightMm / 2,
        fontSize: 4,
        align: "center",
      },
    ],
  };
}

function boxesOverlap(a: NestPlacement, b: NestPlacement) {
  return (
    q(a.xMm) < q(b.xMm + b.widthMm) &&
    q(a.xMm + a.widthMm) > q(b.xMm) &&
    q(a.yMm) < q(b.yMm + b.heightMm) &&
    q(a.yMm + a.heightMm) > q(b.yMm)
  );
}

function assertInside(sheet: NestSheet) {
  for (const placement of sheet.placements) {
    assert.ok(q(placement.xMm) >= 0);
    assert.ok(q(placement.yMm) >= 0);
    assert.ok(q(placement.xMm + placement.widthMm) <= q(sheet.widthMm));
    assert.ok(q(placement.yMm + placement.heightMm) <= q(sheet.heightMm));
    if (placement.rotation === 0) {
      assert.equal(q(placement.widthMm), q(placement.plate.widthMm));
      assert.equal(q(placement.heightMm), q(placement.plate.heightMm));
    } else {
      assert.equal(placement.rotation, 90);
      assert.equal(q(placement.widthMm), q(placement.plate.heightMm));
      assert.equal(q(placement.heightMm), q(placement.plate.widthMm));
    }
  }
  for (let i = 0; i < sheet.placements.length; i += 1) {
    for (let j = i + 1; j < sheet.placements.length; j += 1) {
      assert.equal(boxesOverlap(sheet.placements[i], sheet.placements[j]), false);
    }
  }
}

function segmentLength(segment: CutSegment) {
  return Math.abs(segment.x2 - segment.x1) + Math.abs(segment.y2 - segment.y1);
}

function interiorsOverlap(a: CutSegment, b: CutSegment) {
  const aHorizontal = q(a.y1) === q(a.y2);
  const bHorizontal = q(b.y1) === q(b.y2);
  if (aHorizontal && bHorizontal && q(a.y1) === q(b.y1)) {
    const a1 = Math.min(q(a.x1), q(a.x2));
    const a2 = Math.max(q(a.x1), q(a.x2));
    const b1 = Math.min(q(b.x1), q(b.x2));
    const b2 = Math.max(q(b.x1), q(b.x2));
    return a1 < b2 && b1 < a2;
  }
  const aVertical = q(a.x1) === q(a.x2);
  const bVertical = q(b.x1) === q(b.x2);
  if (aVertical && bVertical && q(a.x1) === q(b.x1)) {
    const a1 = Math.min(q(a.y1), q(a.y2));
    const a2 = Math.max(q(a.y1), q(a.y2));
    const b1 = Math.min(q(b.y1), q(b.y2));
    const b2 = Math.max(q(b.y1), q(b.y2));
    return a1 < b2 && b1 < a2;
  }
  return false;
}

function assertCutsOnce(segments: CutSegment[]) {
  for (let i = 0; i < segments.length; i += 1) {
    for (let j = i + 1; j < segments.length; j += 1) {
      assert.equal(interiorsOverlap(segments[i], segments[j]), false);
    }
  }
}

function parseCuts(svg: string) {
  const cut = svg.split('id="cut"')[1]?.split("</g>")[0] ?? "";
  const segments: CutSegment[] = [];
  for (const match of cut.matchAll(/d="M ([0-9.]+) ([0-9.]+) L ([0-9.]+) ([0-9.]+)"/g)) {
    segments.push({
      x1: Number(match[1]),
      y1: Number(match[2]),
      x2: Number(match[3]),
      y2: Number(match[4]),
    });
  }
  return segments;
}

const two = nestPlates([plate({ widthMm: 40, heightMm: 20, qty: 2, text: "MAIN SWITCH" })]);
assert.equal(two.sheets.length, 1);
assert.equal(two.sheets[0].placements.length, 2);
assert.equal(two.sheets[0].widthMm, SHEET_WIDTH_MM);
assert.equal(two.sheets[0].heightMm, SHEET_HEIGHT_MM);
assertInside(two.sheets[0]);
assert.equal(two.sheets[0].placements.every((item) => item.rotation === 0), true);
assert.deepEqual(
  two.sheets[0].placements.map((item) => [item.xMm, item.yMm]),
  [
    [0, 0],
    [40, 0],
  ]
);
const twoCuts = mergePlateCuts(two.sheets[0].placements);
assertCutsOnce(twoCuts);
const shared = twoCuts.filter((segment) => q(segment.x1) === 40000 && q(segment.x2) === 40000);
assert.equal(shared.length, 1);
assert.equal(q(shared[0].y1), 0);
assert.equal(q(shared[0].y2), 20000);
assert.equal(
  Math.round(twoCuts.reduce((sum, segment) => sum + segmentLength(segment), 0)),
  220
);
const twoSvg = serializeNestSheetSvg(1001, two.sheets[0]);
assert.match(twoSvg, /width="300mm"/);
assert.match(twoSvg, /height="200mm"/);
assert.match(twoSvg, /viewBox="0 0 300 200"/);
assert.match(twoSvg, /Sheet 1 of 1/);
assert.match(twoSvg, /font-weight="400"/);
assert.match(twoSvg, /font-family="Arial, Helvetica, sans-serif"/);
assert.match(twoSvg, /fill="#000000"/);
assert.match(twoSvg, /stroke="#FF0000"/);
assert.equal(twoSvg.includes("<rect"), false);
assert.equal(twoSvg.includes("rotate(90)"), false);
assert.doesNotMatch(twoSvg, /Stik|TraffoLab/i);
assert.deepEqual(parseCuts(twoSvg), twoCuts);
assert.match(twoSvg, /transform="translate\(0, 0\)"/);
assert.match(twoSvg, /transform="translate\(40, 0\)"/);
assert.match(twoSvg, /x="20"/);
assert.match(twoSvg, /y="10"/);

const partial = mergePlateCuts([
  { xMm: 0, yMm: 0, widthMm: 40, heightMm: 20 },
  { xMm: 40, yMm: 0, widthMm: 20, heightMm: 10 },
]);
assertCutsOnce(partial);
const partialShared = partial.filter((segment) => q(segment.x1) === 40000 && q(segment.x2) === 40000);
assert.equal(partialShared.length, 1);
assert.equal(q(partialShared[0].y1), 0);
assert.equal(q(partialShared[0].y2), 20000);
assert.equal(
  Math.round(partial.reduce((sum, segment) => sum + segmentLength(segment), 0)),
  170
);

const row = mergePlateCuts([
  { xMm: 0, yMm: 0, widthMm: 40, heightMm: 20 },
  { xMm: 40, yMm: 0, widthMm: 40, heightMm: 20 },
  { xMm: 80, yMm: 0, widthMm: 40, heightMm: 20 },
]);
assert.equal(
  Math.round(row.reduce((sum, segment) => sum + segmentLength(segment), 0)),
  320
);
assert.equal(
  row.filter((segment) => q(segment.x1) === q(segment.x2) && q(segment.y2) - q(segment.y1) === 20000)
    .length,
  4
);

const seventy = nestPlates([plate({ widthMm: 40, heightMm: 20, qty: 70 })]);
assert.equal(seventy.sheets.length, 1);
assert.equal(seventy.sheets[0].placements.length, 70);
assert.equal(seventy.sheets[0].placements.every((item) => item.rotation === 0), true);
assertInside(seventy.sheets[0]);
assert.equal(q(seventy.sheets[0].placements[69].xMm + seventy.sheets[0].placements[69].widthMm), 280000);
assert.equal(q(seventy.sheets[0].placements[69].yMm + seventy.sheets[0].placements[69].heightMm), 200000);

const seventyOne = nestPlates([
  plate({
    widthMm: 40,
    heightMm: 20,
    qty: 71,
    text: "AHU 1",
    objects: [
      { id: "text-1", text: "AHU 1", x: 20, y: 8, fontSize: 4, align: "center" },
      { id: "text-2", text: "SUPPLY", x: 20, y: 14, fontSize: 3, align: "center" },
    ],
  }),
]);
assert.equal(seventyOne.sheets.length, 1);
assert.equal(seventyOne.sheets[0].placements.length, 71);
assert.equal(seventyOne.sheets[0].placements.every((item) => item.rotation === 90), true);
assertInside(seventyOne.sheets[0]);
assert.deepEqual(
  seventyOne.sheets[0].placements.slice(0, 2).map((item) => [item.xMm, item.yMm, item.widthMm, item.heightMm]),
  [
    [0, 0, 20, 40],
    [20, 0, 20, 40],
  ]
);
const turnedCuts = mergePlateCuts(seventyOne.sheets[0].placements);
assertCutsOnce(turnedCuts);
const turnedShared = turnedCuts.filter((segment) => q(segment.x1) === 20000 && q(segment.x2) === 20000);
assert.equal(turnedShared.length, 1);
assert.equal(q(turnedShared[0].y1), 0);
assert.ok(q(turnedShared[0].y2) >= 40000);
assert.ok(q(turnedShared[0].y2) <= q(SHEET_HEIGHT_MM));
const turnedSvg = serializeNestSheetSvg(1001, seventyOne.sheets[0]);
assert.equal(turnedSvg.match(/rotate\(90\)/g)?.length, 71);
assert.match(turnedSvg, /transform="translate\(20, 0\) rotate\(90\)"/);
assert.match(turnedSvg, /transform="translate\(40, 0\) rotate\(90\)"/);
assert.match(turnedSvg, /x="20"/);
assert.match(turnedSvg, /SUPPLY/);
assert.equal(parseCuts(turnedSvg).length, turnedCuts.length);
const firstTurned = seventyOne.sheets[0].placements[0];
assert.equal(plateGroupTransform(firstTurned), "translate(20, 0) rotate(90)");
assert.deepEqual(mapPlatePoint(20, 10, firstTurned), { xMm: 10, yMm: 20 });
assert.deepEqual(mapPlatePoint(0, 0, firstTurned), { xMm: 20, yMm: 0 });
assert.deepEqual(mapPlatePoint(0, 20, firstTurned), { xMm: 0, yMm: 0 });

const seventyFive = nestPlates([plate({ widthMm: 40, heightMm: 20, qty: 75 })]);
assert.equal(seventyFive.sheets.length, 1);
assert.equal(
  seventyFive.sheets[0].placements.reduce((sum, item) => sum + item.widthMm * item.heightMm, 0),
  SHEET_WIDTH_MM * SHEET_HEIGHT_MM
);
const seventySix = nestPlates([plate({ widthMm: 40, heightMm: 20, qty: 76 })]);
assert.equal(seventySix.sheets.length, 2);
assert.equal(seventySix.sheets[0].index, 1);
assert.equal(seventySix.sheets[1].index, 2);
assert.match(serializeNestSheetSvg(8, seventySix.sheets[1]), /Sheet 2 of 2/);

const exact = nestPlates([plate({ widthMm: 20, heightMm: 10, qty: 300 })]);
assert.equal(exact.sheets.length, 1);
assert.equal(exact.sheets[0].placements.every((item) => item.rotation === 0), true);
assertInside(exact.sheets[0]);
assert.equal(
  exact.sheets[0].placements.reduce((sum, item) => sum + item.widthMm * item.heightMm, 0),
  SHEET_WIDTH_MM * SHEET_HEIGHT_MM
);
const exactNext = nestPlates([plate({ widthMm: 20, heightMm: 10, qty: 301 })]);
assert.equal(exactNext.sheets.length, 2);
assert.equal(exactNext.sheets[1].placements.length, 1);
assert.equal(exactNext.sheets[1].placements[0].rotation, 0);

const mixedBetterUpright = nestPlates([
  plate({ widthMm: 40, heightMm: 20, qty: 70, text: "LARGE" }),
  plate({ widthMm: 20, heightMm: 10, qty: 10, text: "SMALL" }),
]);
assert.equal(mixedBetterUpright.sheets.length, 1);
assert.equal(mixedBetterUpright.sheets[0].placements.length, 80);
assert.equal(
  mixedBetterUpright.sheets[0].placements
    .filter((item) => item.plate.widthMm === 40)
    .every((item) => item.rotation === 0),
  true
);
assertInside(mixedBetterUpright.sheets[0]);
assertCutsOnce(mergePlateCuts(mixedBetterUpright.sheets[0].placements));

const rotateToFit = nestPlates([
  plate({
    widthMm: 180,
    heightMm: 150,
    qty: 2,
    text: "MAIN\nSWITCH",
    objects: [
      { id: "text-1", text: "MAIN\nSWITCH", x: 90, y: 75, fontSize: 8, align: "center" },
    ],
  }),
  plate({ widthMm: 40, heightMm: 20, qty: 1, text: "SMALL" }),
]);
assert.equal(rotateToFit.sheets.length, 1);
assertInside(rotateToFit.sheets[0]);
const large = rotateToFit.sheets[0].placements.filter((item) => item.plate.widthMm === 180);
const small = rotateToFit.sheets[0].placements.filter((item) => item.plate.widthMm === 40);
assert.equal(large.length, 2);
assert.equal(small.length, 1);
assert.equal(large.every((item) => item.rotation === 90), true);
assert.equal(small[0].rotation, 0);
const largeCuts = mergePlateCuts(large);
const between = largeCuts.filter((segment) => q(segment.x1) === 150000 && q(segment.x2) === 150000);
assert.equal(between.length, 1);
assert.equal(q(between[0].y2) - q(between[0].y1), 180000);
const fittedSvg = serializeNestSheetSvg(42, rotateToFit.sheets[0]);
assert.match(fittedSvg, /transform="translate\(150, 0\) rotate\(90\)"/);
assert.match(fittedSvg, /MAIN/);
assert.match(fittedSvg, /SWITCH/);
assert.equal(mapPlatePoint(90, 75, large[0]).xMm, 75);
assert.equal(mapPlatePoint(90, 75, large[0]).yMm, 90);

const onlyRotated = nestPlates([plate({ widthMm: 100, heightMm: 250, qty: 2, text: "TALL" })]);
assert.equal(onlyRotated.sheets.length, 1);
assert.equal(onlyRotated.sheets[0].fitsMaterialSheet, true);
assert.equal(onlyRotated.sheets[0].placements.every((item) => item.rotation === 90), true);
assertInside(onlyRotated.sheets[0]);
assert.deepEqual(
  onlyRotated.sheets[0].placements.map((item) => [item.xMm, item.yMm, item.widthMm, item.heightMm]),
  [
    [0, 0, 250, 100],
    [0, 100, 250, 100],
  ]
);

const colours = nestPlates([
  plate({ widthMm: 40, heightMm: 20, qty: 2, colourPair: "yellow-black", colourLabel: "Yellow / black" }),
  plate({
    widthMm: 40,
    heightMm: 20,
    qty: 2,
    colourPair: "white-black",
    colourLabel: "White / black",
    adhesive3m: true,
  }),
  plate({ widthMm: 40, heightMm: 20, qty: 1, colourPair: "yellow-black", colourLabel: "Yellow / black", adhesive3m: true }),
]);
assert.equal(colours.sheets.length, 3);
assert.deepEqual(
  colours.sheets.map((sheet) => [sheet.colourPair, sheet.adhesive3m, sheet.placements.length]),
  [
    ["yellow-black", false, 2],
    ["white-black", true, 2],
    ["yellow-black", true, 1],
  ]
);
assert.equal(colours.sheets.every((sheet) => sheet.sheetCount === 3), true);

const glacier = nestPlates([
  plate({ widthMm: 40, heightMm: 20, qty: 14, text: "GLACIER AIR", colourPair: "yellow-black", colourLabel: "Yellow / black" }),
  plate({ widthMm: 20, heightMm: 10, qty: 8, text: "AHU 1", colourPair: "yellow-black", colourLabel: "Yellow / black" }),
  plate({ widthMm: 40, heightMm: 20, qty: 4, text: "DB-A", colourPair: "white-black", colourLabel: "White / black" }),
]);
assert.equal(glacier.sheets.length, 2);
assert.equal(glacier.sheets[0].colourPair, "yellow-black");
assert.equal(glacier.sheets[0].placements.length, 22);
assert.equal(glacier.sheets[1].colourPair, "white-black");
assert.equal(glacier.sheets[1].placements.length, 4);
assertInside(glacier.sheets[0]);
assertInside(glacier.sheets[1]);
assert.equal(
  glacier.sheets[0].placements.every((item) => item.plate.colourPair === "yellow-black"),
  true
);
assertCutsOnce(mergePlateCuts(glacier.sheets[0].placements));
assert.match(formatNestSummary(1001, glacier), /Sheet 1 of 2 — Yellow \/ black/);
assert.match(formatNestSummary(1001, glacier), /Sheet 2 of 2 — White \/ black/);
assert.match(formatNestSummary(1001, glacier), /300 × 200 mm/);
assert.doesNotMatch(formatNestSummary(1001, glacier), /Stik|TraffoLab/i);

const oversize = nestPlates([
  plate({ widthMm: 40, heightMm: 20, qty: 1, text: "OK" }),
  plate({ widthMm: 400, heightMm: 100, qty: 1, text: "TOO WIDE" }),
]);
assert.equal(oversize.sheets.length, 2);
assert.equal(oversize.sheets[0].fitsMaterialSheet, true);
assert.equal(oversize.sheets[0].placements.length, 1);
assert.equal(oversize.sheets[1].fitsMaterialSheet, false);
assert.equal(oversize.sheets[1].widthMm, 400);
assert.equal(oversize.sheets[1].heightMm, 100);
assert.match(serializeNestSheetSvg(3, oversize.sheets[1]), /width="400mm"/);
assert.match(formatNestSummary(3, oversize), /Does not fit a 300 × 200 mm sheet/);

const skipped = nestPlates([plate({ widthMm: 0, heightMm: 20, qty: 1, text: "BAD" })]);
assert.equal(skipped.sheets.length, 0);
assert.equal(skipped.skipped.length, 1);

const glacierAir = nestPlates([
  plate({
    widthMm: 40,
    heightMm: 20,
    qty: 159,
    text: "AC1",
    colourPair: "white-black",
    colourLabel: "White / black",
  }),
  plate({
    widthMm: 20,
    heightMm: 10,
    qty: 48,
    text: "AC1",
    colourPair: "white-black",
    colourLabel: "White / black",
  }),
]);
assert.equal(
  glacierAir.sheets.reduce((sum, sheet) => sum + sheet.placements.length, 0),
  207
);
assert.equal(glacierAir.sheets.length, 3);
assert.equal(
  glacierAir.sheets.every(
    (sheet) => sheet.fitsMaterialSheet && sheet.placements.every((item) => item.rotation === 0)
  ),
  true
);
for (const sheet of glacierAir.sheets) {
  assertInside(sheet);
  assertCutsOnce(mergePlateCuts(sheet.placements));
  assert.equal(sheet.widthMm, 300);
  assert.equal(sheet.heightMm, 200);
}

const download = buildProductionDownload(1001, [
  plate({ widthMm: 40, heightMm: 20, qty: 2, text: "GLACIER AIR" }),
]);
assert.ok(download);
assert.equal(download?.contentType, "application/zip");
assert.equal(download?.filename, "trafflabels-order-1001.zip");
const entries = unzipStore(download!.body);
assert.deepEqual(
  entries.map((entry) => entry.name),
  [
    "nest-summary.txt",
    "sheets/trafflabels-1001-sheet-1-of-1-yellow-black.svg",
    "pieces/trafflabels-1001-L1-1of2-glacier-air.svg",
    "pieces/trafflabels-1001-L1-2of2-glacier-air.svg",
  ]
);
const summary = new TextDecoder().decode(entries[0].data);
assert.match(summary, /Sheet 1 of 1/);
assert.match(summary, /2 × 40 × 20 mm/);
const sheetFile = new TextDecoder().decode(entries[1].data);
assert.match(sheetFile, /M 40 0 L 40 20/);
assert.equal(sheetFile.split('d="M 40 0 L 40 20"').length - 1, 1);

const longPlate = (
  text: string
): StoredPlate =>
  plate({
    widthMm: 20,
    heightMm: 10,
    qty: 1,
    text,
    colourPair: "white-black",
    colourLabel: "White / black",
    objects: [
      {
        id: "text-1",
        text,
        x: 10,
        y: 5,
        fontSize: 3,
        align: "center",
      },
    ],
  });

const longLegends = nestPlates([
  longPlate("ADMIN-AC7-THEATRE"),
  longPlate("ADMIN-AC8-PARMELIA"),
]);
assert.equal(longLegends.sheets.length, 1);
assert.equal(longLegends.sheets[0].placements.length, 2);
assert.equal(longLegends.sheets[0].placements.every((item) => item.rotation === 0), true);
assert.deepEqual(
  longLegends.sheets[0].placements.map((item) => [item.xMm, item.yMm, item.widthMm, item.heightMm]),
  [
    [0, 0, 20, 10],
    [20, 0, 20, 10],
  ]
);
const longCuts = mergePlateCuts(longLegends.sheets[0].placements);
assertCutsOnce(longCuts);
const longShared = longCuts.filter((segment) => q(segment.x1) === 20000 && q(segment.x2) === 20000);
assert.equal(longShared.length, 1);
assert.equal(q(longShared[0].y1), 0);
assert.equal(q(longShared[0].y2), 10000);
for (const placement of longLegends.sheets[0].placements) {
  const laid = engraveLayout(placement.plate.objects[0], placement.plate);
  const box = textMetrics({ ...laid, type: "text" });
  assert.equal(laid.text.split("\n").length, 2);
  assert.ok(box.left >= -0.06, `${laid.text} left ${box.left}`);
  assert.ok(box.top >= -0.06, `${laid.text} top ${box.top}`);
  assert.ok(box.left + box.width <= 20.06, `${laid.text} right ${box.left + box.width}`);
  assert.ok(box.top + box.height <= 10.06, `${laid.text} bottom ${box.top + box.height}`);
}
const longSvg = serializeNestSheetSvg(1001, longLegends.sheets[0]);
assert.equal(longSvg.match(/<tspan /g)?.length, 4);
assert.match(longSvg, />ADMIN-AC7</);
assert.match(longSvg, />THEATRE</);
assert.match(longSvg, />ADMIN-AC8</);
assert.match(longSvg, />PARMELIA</);
assert.doesNotMatch(longSvg, /ADMIN-AC7-THEATRE/);
assert.doesNotMatch(longSvg, /ADMIN-AC8-PARMELIA/);
assert.match(longSvg, /font-weight="400"/);
assert.match(longSvg, /font-family="Arial, Helvetica, sans-serif"/);
assert.match(longSvg, /fill="#000000"/);
assert.match(longSvg, /stroke="#FF0000"/);
assert.equal(longSvg.includes("<rect"), false);
assert.equal(
  parseCuts(longSvg).filter((segment) => q(segment.x1) === 20000 && q(segment.x2) === 20000).length,
  1
);
const fixtureSvg = readFileSync(new URL("./fixtures/nest-20x10-long-legends.svg", import.meta.url), "utf8");
assert.equal(longSvg, fixtureSvg);

const longDownload = buildProductionDownload(1001, [
  longPlate("ADMIN-AC7-THEATRE"),
  longPlate("ADMIN-AC8-PARMELIA"),
]);
const longEntries = unzipStore(longDownload!.body);
const longSheet = new TextDecoder().decode(
  longEntries.find((entry) => entry.name.startsWith("sheets/"))!.data
);
const longPiece = new TextDecoder().decode(
  longEntries.find((entry) => entry.name.startsWith("pieces/"))!.data
);
assert.match(longSheet, />ADMIN-AC7</);
assert.match(longSheet, />THEATRE</);
assert.match(longPiece, />ADMIN-AC7</);
assert.match(longPiece, />THEATRE</);
assert.match(longPiece, /font-weight="400"/);
assert.match(longPiece, /stroke="#FF0000"/);
assert.match(longPiece, /fill="#000000"/);

console.log("lib/sheet-nest.test.ts: ok");
