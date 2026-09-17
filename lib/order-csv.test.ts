import assert from "node:assert/strict";
import { parseOrderLines } from "./label-design";
import {
  TEMPLATE_CSV,
  TEMPLATE_FIELDS,
  headersMatchTemplate,
  loadCsvDocument,
  orderLinesFromPreview,
  parseMm,
  previewMappedRows,
  resolveMapping,
  suggestMapping,
} from "./order-csv";

function mappingFor(headers: string[]) {
  return resolveMapping(headers, suggestMapping(headers));
}

{
  const parsed = loadCsvDocument(TEMPLATE_CSV);
  assert.deepEqual(parsed.headers, [...TEMPLATE_FIELDS]);
  assert.equal(headersMatchTemplate(parsed.headers), true);
  const preview = previewMappedRows(parsed, mappingFor(parsed.headers));
  assert.equal(preview.length, 3);
  assert.equal(preview.every((row) => row.errors.length === 0), true);
  assert.deepEqual(
    preview.map((row) => [row.widthMm, row.heightMm]),
    [
      [45, 12],
      [100, 25],
      [60, 20],
    ]
  );
  const lines = orderLinesFromPreview(preview);
  assert.equal(lines[0]?.design.widthMm, 45);
  assert.equal(lines[0]?.design.heightMm, 12);
  const reloaded = parseOrderLines(JSON.parse(JSON.stringify(lines)));
  assert.equal(reloaded[0]?.design.widthMm, 45);
  assert.equal(reloaded[0]?.design.heightMm, 12);
}

{
  const aliases = loadCsvDocument(
    "color,width_mm,height_mm,legend,quantity\nyellow-black,45,12,MAIN,1\n"
  );
  const mapping = suggestMapping(aliases.headers);
  assert.deepEqual(mapping, { colour: 0, width: 1, height: 2, text: 3, qty: 4 });
  const short = suggestMapping(["colour", "w", "h", "text", "qty"]);
  assert.deepEqual(short, { colour: 0, width: 1, height: 2, text: 3, qty: 4 });
}

{
  const invalid = loadCsvDocument(
    "colour,width,height,text,qty\nyellow-black,20x10,12,MAIN,1\nyellow-black,0,12,MAIN,1\nyellow-black,-4,12,MAIN,1\nyellow-black,abc,12,MAIN,1\n"
  );
  const preview = previewMappedRows(invalid, mappingFor(invalid.headers));
  assert.match(preview[0]?.errors[0]?.message ?? "", /not a size/);
  assert.match(preview[1]?.errors[0]?.message ?? "", /greater than 0/);
  assert.match(preview[2]?.errors[0]?.message ?? "", /positive number/);
  assert.match(preview[3]?.errors[0]?.message ?? "", /positive number/);
}

{
  const zero = parseMm("0", "width");
  assert.equal("error" in zero, true);
  const negative = parseMm("-12", "height");
  assert.equal("error" in negative, true);
  const ok = parseMm("12.5 mm", "height");
  assert.deepEqual(ok, { mm: 12.5 });
}

console.log("order-csv tests passed");
