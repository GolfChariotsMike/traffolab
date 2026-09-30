import assert from "node:assert/strict";
import {
  DEFAULT_DESIGN,
  MIN_FONT_MM,
  SIZE_PRESETS,
  applyPlateSize,
  autoTextInset,
  clampObjectToPlate,
  createLegendDesign,
  createTextObject,
  fitTextToPlate,
  maxFontForPlate,
  resizeTextObject,
  serializeLightBurnSvg,
  shrinkTextToPlate,
  textMetrics,
  type ResizeHandle,
  type TextObject,
} from "./label-design";

function assertInside(
  object: TextObject,
  plate: { widthMm: number; heightMm: number },
  label: string
) {
  const metrics = textMetrics(object);
  const slop = 0.06;
  assert.ok(metrics.left >= -slop, `${label} left ${metrics.left}`);
  assert.ok(metrics.top >= -slop, `${label} top ${metrics.top}`);
  assert.ok(
    metrics.left + metrics.width <= plate.widthMm + slop,
    `${label} right ${metrics.left + metrics.width}`
  );
  assert.ok(
    metrics.top + metrics.height <= plate.heightMm + slop,
    `${label} bottom ${metrics.top + metrics.height}`
  );
}

function legend(
  patch: Partial<TextObject> & Pick<TextObject, "text" | "x" | "y" | "fontSize" | "align">
): TextObject {
  return { id: "text-1", type: "text", ...patch };
}

function assertFills(
  object: TextObject,
  plate: { widthMm: number; heightMm: number },
  label: string
) {
  assertInside(object, plate, label);
  const metrics = textMetrics(object);
  const inset = autoTextInset(plate);
  const slackX = plate.widthMm - metrics.width;
  const slackY = plate.heightMm - metrics.height;
  const usedX = metrics.width / plate.widthMm;
  const usedY = metrics.height / plate.heightMm;
  const fill = Math.max(usedX, usedY);
  assert.ok(
    fill >= 0.8,
    `${label} uses ${(usedX * 100).toFixed(0)}% width and ${(usedY * 100).toFixed(0)}% height at ${object.fontSize} mm`
  );
  if (object.fontSize > MIN_FONT_MM) {
    assert.ok(
      fill <= 0.88,
      `${label} fill ${(fill * 100).toFixed(0)}% leaves a larger margin than a ~90% fit`
    );
  }
  const tight = Math.min(slackX, slackY);
  const allowance = Math.max(inset.x, inset.y) * 2 + 1.4;
  assert.ok(
    tight <= allowance,
    `${label} margin ${tight.toFixed(2)} mm (x ${slackX.toFixed(2)}, y ${slackY.toFixed(2)})`
  );
}

{
  const plate = DEFAULT_DESIGN;
  const legendObject = plate.objects[0];
  assert.equal(legendObject.text, "MAIN");
  assert.equal(legendObject.align, "center");
  assert.ok(legendObject.fontSize > 6.5, `default font ${legendObject.fontSize}`);
  assertFills(legendObject, plate, "default");
  const same = clampObjectToPlate(legendObject, plate);
  assert.equal(same.fontSize, legendObject.fontSize);
  assert.equal(same.x, legendObject.x);
  assert.equal(same.y, legendObject.y);
}

{
  for (const preset of SIZE_PRESETS) {
    for (const text of ["MAIN", "MAIN SWITCH", "PV ISOLATOR", "DB-1"]) {
      const fitted = fitTextToPlate(
        legend({ text, x: 0, y: 0, fontSize: MIN_FONT_MM, align: "center" }),
        preset
      );
      assertFills(fitted, preset, `${preset.id} ${text}`);
      const svg = serializeLightBurnSvg({
        ...DEFAULT_DESIGN,
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        objects: [fitted],
      });
      assert.match(svg, new RegExp(`font-size="${fitted.fontSize}"`));
      assert.match(svg, /font-weight="400"/);
      assert.doesNotMatch(svg, /font-weight="600"/);
      assert.match(svg, /font-family="Space Grotesk, Arial, sans-serif"/);
      assert.match(svg, new RegExp(`>${text}<`));
    }
  }
}

{
  const samples = [
    createLegendDesign("yellow-black", 45, 12, "MAIN SWITCH"),
    createLegendDesign("white-black", 100, 25, "PV ISOLATOR"),
    createLegendDesign("red-white", 60, 20, "DB-1 CIRCUIT 14"),
    createLegendDesign("black-white", 80, 30, "PUMP\n1"),
  ];
  for (const design of samples) {
    const object = design.objects[0];
    assertFills(object, design, `${design.widthMm}x${design.heightMm} ${object.text}`);
    const svg = serializeLightBurnSvg(design);
    assert.match(svg, new RegExp(`font-size="${object.fontSize}"`));
  }
}

{
  const plate = { widthMm: 100, heightMm: 50 };
  const grown = applyPlateSize(
    {
      ...DEFAULT_DESIGN,
      objects: [
        legend({ text: "MAIN", x: 10, y: 6, fontSize: 6.5, align: "center" }),
      ],
    },
    plate.widthMm,
    plate.heightMm
  );
  assert.equal(grown.widthMm, 100);
  assert.equal(grown.heightMm, 50);
  assert.ok(grown.objects[0].fontSize > 20, `scaled font ${grown.objects[0].fontSize}`);
  assertFills(grown.objects[0], grown, "size up");
}

{
  const plate = { widthMm: 80, heightMm: 30 };
  const added = createTextObject(plate, "text-2");
  assert.equal(added.text, "TEXT");
  assertFills(added, plate, "new text");
  const kept = shrinkTextToPlate(
    legend({ text: "MAIN", x: 20, y: 12, fontSize: 5, align: "center" }),
    plate
  );
  assert.equal(kept.fontSize, 5);
  assert.equal(kept.x, 20);
}

{
  const plate = { widthMm: 80, heightMm: 30 };
  const start = legend({
    text: "MAIN",
    x: 40,
    y: 18,
    fontSize: 8,
    align: "center",
  });
  const shoved = clampObjectToPlate({ ...start, x: -40, y: -20 }, plate);
  assertInside(shoved, plate, "shoved");
  const metrics = textMetrics(shoved);
  assert.ok(Math.abs(metrics.left) < 0.06, `pinned left ${metrics.left}`);
  assert.ok(Math.abs(metrics.top) < 0.06, `pinned top ${metrics.top}`);
}

{
  const plate = { widthMm: 20, heightMm: 10 };
  const wide = clampObjectToPlate(
    legend({
      text: "DISTRIBUTION BOARD",
      x: 4,
      y: 7,
      fontSize: MIN_FONT_MM,
      align: "left",
    }),
    plate
  );
  const wideBox = textMetrics(wide);
  assert.ok(wideBox.width > plate.widthMm);
  assert.ok(wideBox.left <= 0.06, `wide left ${wideBox.left}`);
  assert.ok(wideBox.left + wideBox.width >= plate.widthMm - 0.06);
  const slid = clampObjectToPlate({ ...wide, x: wide.x - 2 }, plate);
  assert.ok(slid.x < wide.x);
  const slidBox = textMetrics(slid);
  assert.ok(slidBox.left <= 0.06);
  assert.ok(slidBox.left + slidBox.width >= plate.widthMm - 0.06);
}

{
  const plate = { widthMm: 20, heightMm: 10 };
  const huge = clampObjectToPlate(
    legend({ text: "MAIN", x: 10, y: 6, fontSize: 40, align: "center" }),
    plate
  );
  assert.ok(huge.fontSize < 40);
  assert.ok(huge.fontSize >= MIN_FONT_MM);
  assertInside(huge, plate, "huge");
}

{
  const plate = { widthMm: 100, heightMm: 40 };
  const start = legend({
    text: "MAIN",
    x: 50,
    y: 22,
    fontSize: 8,
    align: "center",
  });
  const before = textMetrics(start);
  const origin = { x: before.left + before.width, y: before.top + before.height };
  const pointer = { x: origin.x + 12, y: origin.y + 8 };
  const next = resizeTextObject(start, plate, "se", pointer, origin);
  assert.ok(next.fontSize > start.fontSize, `grew ${next.fontSize}`);
  const after = textMetrics(next);
  assert.ok(
    Math.abs(after.left - before.left) < 0.16,
    `left pin ${before.left} -> ${after.left}`
  );
  assert.ok(
    Math.abs(after.top - before.top) < 0.16,
    `top pin ${before.top} -> ${after.top}`
  );
  assertInside(next, plate, "se grow");

  const idle = resizeTextObject(start, plate, "se", origin, origin);
  assert.equal(idle.fontSize, start.fontSize);
  assert.equal(idle.x, start.x);
  assert.equal(idle.y, start.y);
}

{
  const plate = { widthMm: 80, heightMm: 30 };
  const start = legend({
    text: "PUMP\n1",
    x: 12,
    y: 16,
    fontSize: 8,
    align: "left",
  });
  const before = textMetrics(start);
  const origin = { x: before.left, y: before.top };
  const next = resizeTextObject(
    start,
    plate,
    "nw",
    { x: origin.x - 6, y: origin.y - 4 },
    origin
  );
  assert.ok(next.fontSize > start.fontSize);
  const after = textMetrics(next);
  assert.ok(Math.abs(after.left + after.width - (before.left + before.width)) < 0.16);
  assert.ok(Math.abs(after.top + after.height - (before.top + before.height)) < 0.16);
  assert.equal(next.align, "left");
  assertInside(next, plate, "nw multiline");
}

{
  const plate = { widthMm: 60, heightMm: 20 };
  const start = legend({
    text: "ISOLATOR",
    x: 58,
    y: 12,
    fontSize: 6,
    align: "right",
  });
  const before = textMetrics(start);
  const origin = { x: before.left + before.width / 2, y: before.top };
  const shrunk = resizeTextObject(
    start,
    plate,
    "n",
    { x: origin.x, y: origin.y + 3 },
    origin
  );
  assert.ok(shrunk.fontSize < start.fontSize);
  assert.ok(shrunk.fontSize >= MIN_FONT_MM);
  const after = textMetrics(shrunk);
  assert.ok(
    Math.abs(after.top + after.height - (before.top + before.height)) < 0.16
  );
  assertInside(shrunk, plate, "n shrink");

  const minned = resizeTextObject(
    start,
    plate,
    "n",
    { x: origin.x, y: before.top + before.height + 40 },
    origin
  );
  assert.equal(minned.fontSize, MIN_FONT_MM);
  assertInside(minned, plate, "n min");
}

{
  const plate = { widthMm: 40, heightMm: 16 };
  const start = legend({
    text: "MAIN",
    x: 8,
    y: 10,
    fontSize: 5,
    align: "center",
  });
  const before = textMetrics(start);
  const handles: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  for (const handle of handles) {
    const centerX = before.left + before.width / 2;
    const centerY = before.top + before.height / 2;
    const grown = resizeTextObject(
      start,
      plate,
      handle,
      { x: centerX + 30, y: centerY + 30 },
      { x: centerX + 4, y: centerY + 4 }
    );
    assert.ok(grown.fontSize >= MIN_FONT_MM);
    assert.ok(
      grown.fontSize <= maxFontForPlate(start.text, plate),
      `${handle} font ${grown.fontSize}`
    );
    assertInside(grown, plate, handle);
  }
}

{
  const plate = { widthMm: 90, heightMm: 30 };
  const moved = clampObjectToPlate(
    legend({ text: "MAIN", x: 22.4, y: 16.2, fontSize: 9.5, align: "center" }),
    plate
  );
  const design = {
    ...DEFAULT_DESIGN,
    ...plate,
    objects: [moved],
  };
  const svg = serializeLightBurnSvg(design);
  assert.match(svg, new RegExp(`font-size="${moved.fontSize}"`));
  assert.match(svg, /font-weight="400"/);
  assert.match(svg, new RegExp(`x="${moved.x}"`));
  assert.match(svg, new RegExp(`y="${moved.y}"`));
  assert.equal(svg.includes('stroke="#FEE100"'), false);
}

console.log("label-design tests passed");
