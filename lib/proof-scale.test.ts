import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platesApprovalHash } from "./proofs";
import { proofPlatePx, proofPlateWidth, widestPlateMm } from "./proof-scale";
import type { StoredPlate } from "./orders";

assert.equal(widestPlateMm([{ widthMm: 20 }, { widthMm: 40 }, { widthMm: 0 }]), 40);
assert.equal(proofPlatePx(20, 40, 736), 140);
assert.equal(proofPlatePx(40, 40, 736), 280);
assert.equal(proofPlatePx(40, 40, 736) / proofPlatePx(20, 40, 736), 2);
assert.equal(proofPlatePx(10, 40, 736) / proofPlatePx(20, 40, 736), 0.5);

assert.equal(proofPlatePx(20, 40, 320), 140);
assert.equal(proofPlatePx(40, 40, 320), 280);
assert.equal(proofPlatePx(20, 40, 200), 100);
assert.equal(proofPlatePx(40, 40, 200), 200);

assert.equal(proofPlatePx(20, 300, 360), 24);
assert.equal(proofPlatePx(300, 300, 360), 360);
assert.equal(proofPlatePx(45, 45, 800) / proofPlatePx(20, 45, 800), 45 / 20);
assert.equal(proofPlatePx(12, 45, 800) / proofPlatePx(10, 45, 800), 12 / 10);

const width20 = proofPlateWidth(20);
const width40 = proofPlateWidth(40);
assert.equal(width40.includes("40 * min("), true);
assert.equal(width20.includes("20 * min("), true);
assert.equal(width20.split("min(")[1], width40.split("min(")[1]);

const proofPage = readFileSync(new URL("../app/proof/[token]/page.tsx", import.meta.url), "utf8");
assert.match(proofPage, /proofPlateWidth/);
assert.match(proofPage, /flex-wrap/);
assert.doesNotMatch(proofPage, /Math\.max\(180/);
assert.doesNotMatch(proofPage, /platesApprovalHash/);
assert.match(proofPage, /text \$\{textMm\} mm/);

const plate = {
  widthMm: 20,
  heightMm: 10,
  qty: 1,
  text: "AC",
  unitCents: 150,
  lineCents: 150,
  colourPair: "white-black",
  colourLabel: "White / black",
  adhesive3m: true,
  objects: [{ id: "text-1", text: "AC", x: 10, y: 6, fontSize: 3.4, align: "center" as const }],
  uniformTextMm: 3.4,
} satisfies StoredPlate;
const before = platesApprovalHash([plate]);
assert.equal(platesApprovalHash([plate]), before);

console.log("lib/proof-scale.test.ts: ok");
