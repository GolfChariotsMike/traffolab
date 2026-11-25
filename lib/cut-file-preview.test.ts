import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { collectCutPreview, CUT_PREVIEW_LOCKED, svgSheetsFromZip } from "./cut-file-preview";
import type { CustomCutFile } from "./custom-cut-file";
import { buildProductionDownload } from "./production-download";
import type { StoredPlate } from "./orders";
import { unzipStore } from "./zip";

function plate(text: string, widthMm: number, heightMm: number): StoredPlate {
  return {
    widthMm,
    heightMm,
    qty: 1,
    unitCents: 400,
    lineCents: 400,
    colourPair: "yellow-black",
    colourLabel: "Yellow / black",
    adhesive3m: false,
    text,
    objects: [{ id: "text-1", text, x: widthMm / 2, y: heightMm / 2, fontSize: 4, align: "center" }],
  };
}

const download = buildProductionDownload(1006, [
  plate("EDGE", 280, 180),
  plate("TECH", 280, 180),
]);
assert.ok(download);
const sheets = svgSheetsFromZip(download.body);
const zippedSheets = unzipStore(download.body).filter((entry) => entry.name.startsWith("sheets/"));
assert.ok(sheets.length >= 2, "preview includes every nested sheet");
assert.equal(sheets.length, zippedSheets.length);
for (let i = 0; i < sheets.length; i += 1) {
  assert.equal(sheets[i].name, zippedSheets[i].name);
  assert.equal(Buffer.from(sheets[i].body).equals(Buffer.from(zippedSheets[i].data)), true);
  const text = new TextDecoder().decode(sheets[i].body);
  assert.match(text, /<svg/);
  assert.match(text, /#FF0000/);
}
assert.equal(
  unzipStore(download.body).some((entry) => entry.name.startsWith("pieces/")),
  true
);
assert.equal(
  sheets.some((sheet) => sheet.name.startsWith("pieces/")),
  false
);

const logo = "<svg xmlns=\"http://www.w3.org/2000/svg\"><path id=\"edgetech-logo\" d=\"M0 0 L10 10\"/></svg>";
const custom: CustomCutFile = {
  path: "orders/1006/trafflabels-order-1006-sheet-1-yellow-black-gadugi.svg",
  filename: "trafflabels-order-1006-sheet-1-yellow-black-gadugi.svg",
  uploadedAt: "",
  note: "Logo + Gadugi Bold",
};
const customPreview = await collectCutPreview({
  orderNumber: 1006,
  plates: [plate("EDGE", 70, 20)],
  customCutFiles: [custom],
  readObject: async (file) => {
    assert.equal(file.path, custom.path);
    return new TextEncoder().encode(logo);
  },
});
assert.equal(customPreview.ok, true);
if (!customPreview.ok) throw new Error("expected a custom preview");
assert.equal(customPreview.sheets.length, 1);
assert.equal(customPreview.sheets[0].name, custom.filename);
assert.equal(new TextDecoder().decode(customPreview.sheets[0].body), logo);
assert.doesNotMatch(new TextDecoder().decode(customPreview.sheets[0].body), /TraffLabels order/);

let reads = 0;
const autoPreview = await collectCutPreview({
  orderNumber: 42,
  plates: [plate("DB", 40, 15)],
  readObject: async () => {
    reads += 1;
    return new Uint8Array();
  },
});
assert.equal(autoPreview.ok, true);
assert.equal(reads, 0);

const lbrn = await collectCutPreview({
  orderNumber: 7,
  plates: [plate("DB", 40, 15)],
  customCutFiles: [
    {
      path: "orders/7/job.lbrn2",
      filename: "job.lbrn2",
      uploadedAt: "",
      note: "",
    },
  ],
  readObject: async () => new TextEncoder().encode("<?xml version=\"1.0\"?><LightBurnProject/>"),
});
assert.equal(lbrn.ok, false);
if (lbrn.ok) throw new Error("lbrn should not preview as a sheet");
assert.equal(lbrn.code, "unpreviewable");

const packed = deflateRawSync(Buffer.from(logo));
const name = new TextEncoder().encode("logo.svg");
const local = new Uint8Array(30 + name.length + packed.length);
const view = new DataView(local.buffer);
view.setUint32(0, 0x04034b50, true);
view.setUint16(8, 8, true);
view.setUint32(18, packed.length, true);
view.setUint16(26, name.length, true);
local.set(name, 30);
local.set(packed, 30 + name.length);
const inflated = unzipStore(local);
assert.equal(new TextDecoder().decode(inflated[0].data), logo);

const route = readFileSync(
  new URL("../app/api/admin/orders/[id]/cut-preview/load.ts", import.meta.url),
  "utf8"
);
const holdAt = route.indexOf("cutFileHoldForOrder");
const collectAt = route.indexOf("collectCutPreview");
assert.ok(holdAt > 0 && collectAt > holdAt);
assert.match(route, /status: 409/);

const ui = readFileSync(new URL("../components/admin/cut-file-preview.tsx", import.meta.url), "utf8");
assert.match(ui, /Preview cut file/);
assert.match(ui, /CUT_PREVIEW_LOCKED/);
assert.match(ui, /bg-white/);
assert.match(ui, /\/files\//);
assert.doesNotMatch(ui, /proofPlateSvg|proof-plate/);
assert.equal(CUT_PREVIEW_LOCKED, "Locked until the customer approves the proof.");

const board = readFileSync(new URL("../components/admin/orders-board.tsx", import.meta.url), "utf8");
const dialogAt = board.indexOf('aria-labelledby="order-dialog-title"');
const panelAt = board.indexOf("<CustomCutFilePanel", dialogAt);
const customerAt = board.indexOf(">Customer<", dialogAt);
assert.match(board, /<CutFilePreview/);
assert.ok(dialogAt > 0 && panelAt > dialogAt && customerAt > panelAt);

console.log("lib/cut-file-preview.test.ts: ok");
