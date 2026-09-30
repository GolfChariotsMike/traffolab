import assert from "node:assert/strict";
import {
  DEFAULT_DESIGN,
  MAX_PLATE_HEIGHT_MM,
  MAX_PLATE_WIDTH_MM,
  MIN_FONT_MM,
  MIN_PLATE_MM,
  SIZE_PRESETS,
  applyPlateSize,
  autoTextInset,
  clampDesignerPlateAxis,
  clampFreeformPlateSize,
  clampObjectToPlate,
  clampPlateSize,
  createLegendDesign,
  createOrderLine,
  createTextObject,
  engraveLayout,
  exactSizePreset,
  fitTextToPlate,
  maxFontForPlate,
  parseDesign,
  parseOrderLines,
  parseStoredDesign,
  resizeTextObject,
  serializeLightBurnSvg,
  shrinkTextToPlate,
  textMetrics,
  wrapLegendToFit,
  type ResizeHandle,
  type TextObject,
} from "./label-design";

function assertInside(
  object: TextObject,
  plate: { widthMm: number; heightMm: number },
  label: string
) {
  const metrics = textMetrics(object, plate);
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
  const metrics = textMetrics(object, plate);
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
      const fittedBox = textMetrics(fitted, preset);
      const widerThanMin =
        fitted.fontSize === MIN_FONT_MM &&
        fittedBox.width > preset.widthMm + 0.06;
      if (widerThanMin) {
        const hangLeft = -fittedBox.left;
        const hangRight = fittedBox.left + fittedBox.width - preset.widthMm;
        assert.ok(
          Math.abs(hangLeft - hangRight) < 0.15,
          `${preset.id} ${text} overflow not centred (${hangLeft.toFixed(3)} / ${hangRight.toFixed(3)})`
        );
      } else {
        assertFills(fitted, preset, `${preset.id} ${text}`);
      }
      const svg = serializeLightBurnSvg({
        ...DEFAULT_DESIGN,
        widthMm: preset.widthMm,
        heightMm: preset.heightMm,
        objects: [fitted],
      });
      assert.match(svg, new RegExp(`font-size="${fitted.fontSize}"`));
      assert.match(svg, /font-weight="400"/);
      assert.doesNotMatch(svg, /font-weight="600"/);
      assert.match(svg, /font-family="Arial, Helvetica, sans-serif"/);
      const laidOut = wrapLegendToFit(fitted.text, preset);
      for (const line of laidOut.split("\n")) {
        assert.ok(svg.includes(`>${line}<`), `${preset.id} ${text} missing ${line}`);
      }
      if (laidOut.includes("\n")) {
        assert.equal(laidOut.split("\n").length, 2);
        assert.equal(fitted.text, text);
        assert.ok(
          fittedBox.width <= preset.widthMm + 0.06,
          `${preset.id} ${text} wrapped width ${fittedBox.width}`
        );
      }
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
  assert.equal(wide.text, "DISTRIBUTION BOARD");
  const wideBox = textMetrics(wide, plate);
  assert.equal(wrapLegendToFit(wide.text, plate).split("\n").length, 2);
  assert.ok(wideBox.width <= plate.widthMm + 0.06, `wrapped width ${wideBox.width}`);
  assert.ok(wideBox.left >= -0.06, `wrapped left ${wideBox.left}`);
  assert.ok(wideBox.left + wideBox.width <= plate.widthMm + 0.06);

  const overflow = clampObjectToPlate(
    legend({
      text: "W".repeat(30),
      x: 4,
      y: 7,
      fontSize: MIN_FONT_MM,
      align: "left",
    }),
    plate
  );
  const overflowBox = textMetrics(overflow, plate);
  assert.ok(overflowBox.width > plate.widthMm);
  assert.ok(overflowBox.left <= 0.06, `wide left ${overflowBox.left}`);
  assert.ok(overflowBox.left + overflowBox.width >= plate.widthMm - 0.06);
  const slid = clampObjectToPlate({ ...overflow, x: overflow.x - 2 }, plate);
  assert.ok(slid.x < overflow.x);
  const slidBox = textMetrics(slid, plate);
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

{
  // 45 × 12 is the CSV template size. Nearest preset is 60 × 20 — do not snap.
  const snapped = clampPlateSize(45, 12);
  assert.equal(snapped.widthMm, 60);
  assert.equal(snapped.heightMm, 20);
  const free = clampFreeformPlateSize(45, 12);
  assert.deepEqual(free, { widthMm: 45, heightMm: 12 });
  assert.equal(exactSizePreset(45, 12), null);
  assert.equal(exactSizePreset(60, 20), "60x20");
}

{
  const source = createLegendDesign("yellow-black", 45, 12, "AC1");
  const opened = parseDesign(JSON.parse(JSON.stringify(source)));
  assert.ok(opened);
  assert.equal(opened.widthMm, 45);
  assert.equal(opened.heightMm, 12);
  assert.equal(opened.objects[0]?.text, "AC1");
  const forced = parseDesign(source, { snapToPreset: true });
  assert.equal(forced?.widthMm, 60);
  assert.equal(forced?.heightMm, 20);
}

{
  // CSV row → order line → designer storage → plate designer load.
  const line = createOrderLine(
    createLegendDesign("yellow-black", 45, 12, "AC1"),
    10
  );
  const stored = JSON.parse(JSON.stringify(line.design));
  const opened = parseStoredDesign(stored);
  assert.equal(opened.widthMm, 45);
  assert.equal(opened.heightMm, 12);
  assert.equal(opened.objects[0]?.text, "AC1");
  const svg = serializeLightBurnSvg(opened);
  assert.match(svg, /width="45mm" height="12mm" viewBox="0 0 45 12"/);
  assert.notEqual(opened.widthMm, clampPlateSize(45, 12).widthMm);

  const second = parseStoredDesign(
    createLegendDesign("white-black", 100, 25, "AC2")
  );
  assert.equal(second.widthMm, 100);
  assert.equal(second.heightMm, 25);
  assert.deepEqual(clampPlateSize(100, 25), { widthMm: 80, heightMm: 30 });

  const reloaded = parseOrderLines([
    {
      id: line.id,
      qty: line.qty,
      svg: line.svg,
      design: stored,
    },
  ]);
  assert.equal(reloaded[0]?.design.widthMm, 45);
  assert.equal(reloaded[0]?.design.heightMm, 12);
}

{
  const custom = applyPlateSize(DEFAULT_DESIGN, 45, 12);
  assert.equal(custom.widthMm, 45);
  assert.equal(custom.heightMm, 12);
  assertFills(custom.objects[0], custom, "custom 45x12");
  const svg = serializeLightBurnSvg(custom);
  assert.match(svg, /width="45mm" height="12mm" viewBox="0 0 45 12"/);
  assert.match(svg, /font-size="[^"]+"/);

  const preset = applyPlateSize(custom, 80, 30);
  assert.equal(preset.widthMm, 80);
  assert.equal(preset.heightMm, 30);
  assert.equal(exactSizePreset(preset.widthMm, preset.heightMm), "80x30");

  const capped = applyPlateSize(DEFAULT_DESIGN, 900, 900);
  assert.equal(capped.widthMm, MAX_PLATE_WIDTH_MM);
  assert.equal(capped.heightMm, MAX_PLATE_HEIGHT_MM);

  const tiny = applyPlateSize(DEFAULT_DESIGN, 0.04, 0);
  assert.equal(tiny.widthMm, 0.1);
  assert.equal(tiny.heightMm, 0.1);
}

{
  assert.equal(clampDesignerPlateAxis(45, "width"), 45);
  assert.equal(clampDesignerPlateAxis(12.55, "height"), 12.6);
  assert.equal(clampDesignerPlateAxis(4, "width"), MIN_PLATE_MM);
  assert.equal(clampDesignerPlateAxis(4, "height"), MIN_PLATE_MM);
  assert.equal(clampDesignerPlateAxis(900, "width"), MAX_PLATE_WIDTH_MM);
  assert.equal(clampDesignerPlateAxis(900, "height"), MAX_PLATE_HEIGHT_MM);
}

{
  const plate = { widthMm: 20, heightMm: 10 };
  assert.equal(wrapLegendToFit("AC3-ER", plate), "AC3-ER");
  assert.equal(wrapLegendToFit("MAIN", plate), "MAIN");
  assert.equal(wrapLegendToFit("PUMP\n1", plate), "PUMP\n1");
  assert.equal(wrapLegendToFit("ADMIN-AC7-THEATRE", plate), "ADMIN-AC7\nTHEATRE");
  assert.equal(wrapLegendToFit("ADMIN-AC8-PARMELIA", plate), "ADMIN-AC8\nPARMELIA");
  assert.equal(wrapLegendToFit("MAIN SWITCH", plate), "MAIN\nSWITCH");

  const theatre = fitTextToPlate(
    legend({
      text: "ADMIN-AC7-THEATRE",
      x: 0,
      y: 0,
      fontSize: MIN_FONT_MM,
      align: "center",
    }),
    plate
  );
  assert.equal(theatre.text, "ADMIN-AC7-THEATRE");
  assert.equal(wrapLegendToFit(theatre.text, plate), "ADMIN-AC7\nTHEATRE");
  assert.equal(theatre.align, "center");
  assert.ok(theatre.fontSize >= MIN_FONT_MM);
  assertInside(theatre, plate, "ADMIN-AC7-THEATRE");
  const theatreBox = textMetrics(theatre, plate);
  assert.ok(theatreBox.width <= plate.widthMm - autoTextInset(plate).x * 2 + 0.06);
  const topGap = theatreBox.top;
  const bottomGap = plate.heightMm - (theatreBox.top + theatreBox.height);
  assert.ok(
    Math.abs(topGap - bottomGap) < 0.15,
    `vertical centre ${topGap.toFixed(2)} / ${bottomGap.toFixed(2)}`
  );
  const theatreSvg = serializeLightBurnSvg({
    ...DEFAULT_DESIGN,
    ...plate,
    objects: [theatre],
  });
  assert.match(
    theatreSvg,
    /<tspan x="[^"]+" dy="0">ADMIN-AC7<\/tspan><tspan x="[^"]+" dy="[^"]+">THEATRE<\/tspan>/
  );
  assert.match(theatreSvg, /font-weight="400"/);
  assert.match(theatreSvg, /font-family="Arial, Helvetica, sans-serif"/);
  const theatreEngrave = theatreSvg.split('id="engrave"')[1] ?? "";
  assert.doesNotMatch(theatreEngrave, /ADMIN-AC7-THEATRE/);

  const parmelia = fitTextToPlate(
    legend({
      text: "ADMIN-AC8-PARMELIA",
      x: 10,
      y: 5,
      fontSize: MIN_FONT_MM,
      align: "center",
    }),
    plate
  );
  assert.equal(parmelia.text, "ADMIN-AC8-PARMELIA");
  assert.equal(wrapLegendToFit(parmelia.text, plate), "ADMIN-AC8\nPARMELIA");
  assertInside(parmelia, plate, "ADMIN-AC8-PARMELIA");

  const token = wrapLegendToFit("WWWWWWWWWW", plate);
  const [tokenLeft, tokenRight] = token.split("\n");
  assert.equal(token.split("\n").length, 2);
  assert.equal(`${tokenLeft}${tokenRight}`, "WWWWWWWWWW");
  const tokenFit = fitTextToPlate(
    legend({ text: "WWWWWWWWWW", x: 10, y: 5, fontSize: MIN_FONT_MM, align: "center" }),
    plate
  );
  assertInside(tokenFit, plate, "mid-token");
  assert.equal(tokenFit.text, "WWWWWWWWWW");
  assert.ok(textMetrics(tokenFit, plate).width <= plate.widthMm + 0.06);

  const stored = engraveLayout(
    legend({
      text: "ADMIN-AC7-THEATRE",
      x: 10,
      y: 5,
      fontSize: MIN_FONT_MM,
      align: "center",
    }),
    plate
  );
  assert.equal(stored.text, "ADMIN-AC7\nTHEATRE");
  assert.equal(stored.fontSize, theatre.fontSize);
  assert.equal(stored.x, theatre.x);
  assert.equal(stored.y, theatre.y);
  const already = engraveLayout(
    { ...theatre, text: stored.text },
    plate
  );
  assert.equal(already.x, theatre.x);
  assert.equal(already.y, theatre.y);
  assert.equal(already.text, stored.text);
}

console.log("label-design tests passed");
