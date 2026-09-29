import assert from "node:assert/strict";
import { buildProductionDownload } from "./production-download";
import {
  CUT_STROKE,
  ENGRAVE_FILL,
  LIGHTBURN_SVG_DPI,
  productionFiles,
  serializeProductionSvg,
} from "./production-svg";
import { unzipStore } from "./zip";
import type { StoredPlate } from "./orders";

const plate: StoredPlate = {
  widthMm: 60,
  heightMm: 20,
  qty: 2,
  unitCents: 600,
  lineCents: 1200,
  colourPair: "yellow-black",
  colourLabel: "Yellow / black",
  adhesive3m: false,
  text: "MAIN & SWITCH",
  objects: [
    {
      id: "text-1",
      text: "MAIN & SWITCH",
      x: 30,
      y: 12,
      fontSize: 6.5,
      align: "center",
    },
  ],
};

const svg = serializeProductionSvg(plate);
assert.equal(LIGHTBURN_SVG_DPI, 96);
assert.match(svg, /width="60mm"/);
assert.match(svg, /height="20mm"/);
assert.match(svg, /viewBox="0 0 60 20"/);
assert.match(svg, new RegExp(`fill="${ENGRAVE_FILL}"`));
assert.match(svg, new RegExp(`stroke="${CUT_STROKE}"`));
assert.match(svg, /id="engrave"/);
assert.match(svg, /id="cut"/);
assert.match(svg, /MAIN &amp; SWITCH/);
assert.equal(svg.includes("#0000FF"), false);
assert.match(svg, /fill="none" stroke="#FF0000"/);
assert.match(svg, /stroke="none"/);
assert.match(svg, /use 96/);
assert.match(svg, /1 user unit = 1 mm/);
assert.doesNotMatch(svg, /fill="#F5D000"/);

const second: StoredPlate = {
  ...plate,
  widthMm: 100,
  heightMm: 25,
  qty: 1,
  text: "PV ISOLATOR",
  objects: [{ id: "text-1", text: "PV ISOLATOR", x: 50, y: 16, fontSize: 8, align: "left" }],
};

const files = productionFiles(1042, [plate, second]);
assert.equal(files.length, 3);
assert.equal(files[0].filename, "trafflabels-1042-L1-1of2-main-switch.svg");
assert.equal(files[1].filename, "trafflabels-1042-L1-2of2-main-switch.svg");
assert.equal(files[2].filename, "trafflabels-1042-L2-1of1-pv-isolator.svg");
assert.match(files[2].svg, /width="100mm"/);
assert.match(files[2].svg, /height="25mm"/);
assert.match(files[2].svg, /viewBox="0 0 100 25"/);

const single = buildProductionDownload(7, [{ ...second, qty: 1 }]);
assert.ok(single);
assert.equal(single?.contentType.startsWith("image/svg+xml"), true);
assert.match(single?.filename ?? "", /\.svg$/);

const zip = buildProductionDownload(1042, [plate, second]);
assert.ok(zip);
assert.equal(zip?.contentType, "application/zip");
assert.equal(zip?.filename, "trafflabels-order-1042.zip");
const entries = unzipStore(zip!.body);
assert.deepEqual(
  entries.map((entry) => entry.name),
  files.map((file) => file.filename)
);
const firstSvg = new TextDecoder().decode(entries[0].data);
assert.match(firstSvg, /width="60mm"/);
assert.match(firstSvg, /height="20mm"/);
assert.match(firstSvg, /fill="#000000"/);
assert.match(firstSvg, /stroke="#FF0000"/);

console.log("lib/production-svg.test.ts: ok");
