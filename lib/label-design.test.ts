import assert from "node:assert/strict";
import {
  DEFAULT_DESIGN,
  MIN_FONT_MM,
  clampObjectToPlate,
  resizeTextObject,
  serializeLightBurnSvg,
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

{
  const plate = DEFAULT_DESIGN;
  const same = clampObjectToPlate(DEFAULT_DESIGN.objects[0], plate);
  assert.equal(same.fontSize, 6.5);
  assert.equal(same.x, 10);
  assert.equal(same.y, 6.8);
  assertInside(same, plate, "default");
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
    assert.ok(grown.fontSize <= 16, `${handle} font ${grown.fontSize}`);
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
  assert.match(svg, new RegExp(`x="${moved.x}"`));
  assert.match(svg, new RegExp(`y="${moved.y}"`));
  assert.equal(svg.includes('stroke="#FEE100"'), false);
}

console.log("label-design tests passed");
