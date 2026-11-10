import assert from "node:assert/strict";
import { emForCapHeightMm } from "./engrave-fonts";
import {
  ID_TAG_FONT_MM,
  ID_TAG_HOLE,
  rotech1005Plates,
  rotech1005TagBand,
} from "./fixtures/rotech-1005";
import {
  applyFixedTextSize,
  capHeightMm,
  layoutLegendAtFont,
  serializeHoleCircles,
  textBand,
} from "./label-design";
import { proofPlateSvg } from "./proof-plate";
import { canonicalPlates, platesApprovalHash } from "./proofs";
import { serializeProductionSvg } from "./production-svg";
import type { StoredPlate } from "./orders";

const base: StoredPlate = {
  widthMm: 30,
  heightMm: 10,
  qty: 1,
  unitCents: 225,
  lineCents: 225,
  colourPair: "white-black",
  colourLabel: "White / black",
  adhesive3m: false,
  text: "IV-01",
  objects: [{ id: "text-1", text: "IV-01", x: 15, y: 7.4, fontSize: 6.8, align: "center" }],
  uniformTextMm: 6.8,
};

const hash = platesApprovalHash([base]);
assert.equal(platesApprovalHash([{ ...base, holes: [] }]), hash);
assert.equal(
  platesApprovalHash([
    {
      ...base,
      objects: [{ ...base.objects[0], fontWeight: 400 }],
    },
  ]),
  hash
);
assert.equal(
  platesApprovalHash([
    {
      ...base,
      objects: [{ ...base.objects[0], fontFace: "arial" }],
    },
  ]),
  hash
);
assert.notEqual(platesApprovalHash([{ ...base, holes: [ID_TAG_HOLE] }]), hash);
assert.notEqual(
  platesApprovalHash([
    {
      ...base,
      objects: [{ ...base.objects[0], fontWeight: 700 }],
    },
  ]),
  hash
);
assert.notEqual(
  platesApprovalHash([
    {
      ...base,
      objects: [{ ...base.objects[0], fontFace: "condensed" }],
    },
  ]),
  hash
);
assert.equal("holes" in canonicalPlates([base])[0], false);
assert.equal("fontWeight" in canonicalPlates([base])[0].objects[0], false);
assert.equal("fontFace" in canonicalPlates([base])[0].objects[0], false);

const production = serializeProductionSvg({
  ...base,
  holes: [ID_TAG_HOLE],
  objects: [{ ...base.objects[0], fontWeight: 700, fontFace: "condensed" }],
});
assert.match(production, /font-weight="700"/);
assert.match(production, /font-family=\"'Roboto Condensed', sans-serif\"/);
assert.match(production, /id="hole-1"/);
assert.match(production, /cx="4"/);
assert.match(production, /cy="5"/);
assert.match(production, /r="1.5"/);
assert.match(production, /fill="none" stroke="#FF0000"/);
assert.match(production, /hole cuts/);

const proof = proofPlateSvg({
  ...base,
  holes: [ID_TAG_HOLE],
});
assert.match(proof, /id="hole-1"/);
assert.match(proof, /cx="4"/);
assert.match(proof, /r="1.5"/);
assert.match(proof, /fill="#E8E8E8"/);

const circles = serializeHoleCircles([ID_TAG_HOLE], "#FF0000", 0.1);
assert.match(circles, /<circle id="hole-1" cx="4" cy="5" r="1.5"/);
assert.equal(serializeHoleCircles([], "#FF0000", 0.1), "");

assert.equal(ID_TAG_FONT_MM, emForCapHeightMm(5, "condensed"));
assert.equal(ID_TAG_FONT_MM, 7.033);
assert.equal(capHeightMm(ID_TAG_FONT_MM, "condensed"), 5);

const band = rotech1005TagBand();
assert.equal(band.left, 5.9);
assert.equal(band.right, 29.6);
assert.equal(band.width, 23.7);

const plateWithHole = { widthMm: 30, heightMm: 10, holes: [ID_TAG_HOLE] };
const arialAtFiveMmCaps = layoutLegendAtFont("NRV-01", plateWithHole, 6.8);
assert.equal(arialAtFiveMmCaps.fits, false);

const nrv01 = layoutLegendAtFont("NRV-01", plateWithHole, ID_TAG_FONT_MM, "condensed");
const nrv02 = layoutLegendAtFont("NRV-02", plateWithHole, ID_TAG_FONT_MM, "condensed");
assert.equal(nrv01.fits, true);
assert.equal(nrv02.fits, true);
assert.equal(nrv01.horizontalClearanceMm, nrv02.horizontalClearanceMm);
assert.ok(
  nrv01.horizontalClearanceMm >= 1.4,
  `NRV-01 horizontal clearance ${nrv01.horizontalClearanceMm}`
);
console.log(
  `NRV-01/02 condensed ${ID_TAG_FONT_MM} mm em, cap ${capHeightMm(ID_TAG_FONT_MM, "condensed")} mm: ` +
    `horizontal ${nrv01.horizontalClearanceMm} mm, vertical ${nrv01.verticalClearanceMm} mm, band ${band.width} mm`
);

const placed = applyFixedTextSize(
  [
    {
      ...base,
      holes: [ID_TAG_HOLE],
      objects: [{ ...base.objects[0], fontFace: "condensed" as const }],
    },
  ],
  ID_TAG_FONT_MM
)[0];
assert.equal(placed.objects[0].x, Math.round(band.centerX * 10) / 10);
assert.equal(placed.objects[0].fontFace, "condensed");

const fourMmArialBand = textBand({
  widthMm: 30,
  heightMm: 10,
  holes: [{ cx: 4, cy: 5, diameterMm: 3 }],
});
assert.ok(fourMmArialBand.width < 24.18);

const plates = rotech1005Plates();
assert.equal(plates.length, 14);
assert.equal(plates[0].holes?.[0].cx, 4);
assert.equal(plates[0].objects[0].fontFace, "condensed");
assert.equal(plates[0].objects[0].fontSize, 7.033);
assert.equal(plates[12].text, "MV-22");
const nameplate = plates[13];
assert.equal(nameplate.objects.length, 9);
assert.equal(nameplate.objects[0].fontWeight, 700);
assert.equal(nameplate.objects[0].fontFace, undefined);
assert.equal(nameplate.objects[0].fontSize, 4);
assert.equal(nameplate.objects[6].fontWeight, 700);
assert.equal(nameplate.objects[6].text, "ROTECH WATER");
assert.equal(nameplate.objects[1].fontWeight, undefined);
assert.match(serializeProductionSvg(nameplate), /font-weight="700"/);
assert.match(serializeProductionSvg(nameplate), /font-family="Arial, Helvetica, sans-serif"/);
assert.match(proofPlateSvg(nameplate), /font-weight="700"/);
assert.doesNotMatch(serializeProductionSvg(nameplate), /id="hole-/);
assert.match(serializeProductionSvg(plates[1]), /font-family=\"'Roboto Condensed', sans-serif\"/);

console.log("lib/holes-and-weight.test.ts: ok");
