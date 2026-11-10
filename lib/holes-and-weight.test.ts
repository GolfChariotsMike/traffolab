import assert from "node:assert/strict";
import { ID_TAG_HOLE, rotech1005Plates, rotech1005TagBand } from "./fixtures/rotech-1005";
import {
  applyFixedTextSize,
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
assert.equal("holes" in canonicalPlates([base])[0], false);
assert.equal("fontWeight" in canonicalPlates([base])[0].objects[0], false);

const production = serializeProductionSvg({
  ...base,
  holes: [ID_TAG_HOLE],
  objects: [{ ...base.objects[0], fontWeight: 700 }],
});
assert.match(production, /font-weight="700"/);
assert.match(production, /id="hole-1"/);
assert.match(production, /cx="3.3"/);
assert.match(production, /cy="5"/);
assert.match(production, /r="1.5"/);
assert.match(production, /fill="none" stroke="#FF0000"/);
assert.match(production, /hole cuts/);

const proof = proofPlateSvg({
  ...base,
  holes: [ID_TAG_HOLE],
});
assert.match(proof, /id="hole-1"/);
assert.match(proof, /cx="3.3"/);
assert.match(proof, /r="1.5"/);
assert.match(proof, /fill="#E8E8E8"/);

const circles = serializeHoleCircles([ID_TAG_HOLE], "#FF0000", 0.1);
assert.match(circles, /<circle id="hole-1" cx="3.3" cy="5" r="1.5"/);
assert.equal(serializeHoleCircles([], "#FF0000", 0.1), "");

const band = rotech1005TagBand();
const nrv = layoutLegendAtFont("NRV-01", { widthMm: 30, heightMm: 10, holes: [ID_TAG_HOLE] }, 6.8);
assert.equal(nrv.fits, true);
assert.ok(nrv.horizontalClearanceMm > 0, `NRV-01 clearance ${nrv.horizontalClearanceMm}`);
assert.ok(band.width >= 24.18, `band width ${band.width}`);
assert.equal(band.left, 5.2);
assert.equal(band.right, 29.6);

const placed = applyFixedTextSize(
  [
    {
      ...base,
      holes: [ID_TAG_HOLE],
    },
  ],
  6.8
)[0];
assert.equal(placed.objects[0].x, band.centerX);
assert.equal(placed.objects[0].y, 7.4);

const fourMmBand = textBand({
  widthMm: 30,
  heightMm: 10,
  holes: [{ cx: 4, cy: 5, diameterMm: 3 }],
});
const fourMm = layoutLegendAtFont(
  "NRV-01",
  { widthMm: 30, heightMm: 10, holes: [{ cx: 4, cy: 5, diameterMm: 3 }] },
  6.8
);
assert.equal(fourMm.fits, false);
assert.ok(fourMmBand.width < 24.18);

const plates = rotech1005Plates();
assert.equal(plates.length, 14);
assert.equal(plates[0].holes?.[0].cx, 3.3);
assert.equal(plates[12].text, "MV-22");
const nameplate = plates[13];
assert.equal(nameplate.objects.length, 9);
assert.equal(nameplate.objects[0].fontWeight, 700);
assert.equal(nameplate.objects[0].fontSize, 4);
assert.equal(nameplate.objects[6].fontWeight, 700);
assert.equal(nameplate.objects[6].text, "ROTECH WATER");
assert.equal(nameplate.objects[1].fontWeight, undefined);
assert.match(serializeProductionSvg(nameplate), /font-weight="700"/);
assert.match(proofPlateSvg(nameplate), /font-weight="700"/);
assert.doesNotMatch(serializeProductionSvg(nameplate), /id="hole-/);

console.log("lib/holes-and-weight.test.ts: ok");
