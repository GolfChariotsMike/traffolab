import { Label } from "@/components/ui/label";
import {
  TEMPLATE_FIELDS,
  type ColumnMapping,
  type CsvField,
  type ParsedCsv,
} from "@/lib/order-csv";

const FIELD_LABELS: Record<CsvField, string> = {
  colour: "Colour",
  size: "Size",
  text: "Text",
  qty: "Qty",
};

export function ColumnMapper({
  document,
  mapping,
  onChange,
}: {
  document: ParsedCsv;
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
}) {
  const previewRows = document.rows.slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h3 className="font-heading text-lg font-semibold text-paper">
          Map columns
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-paper/60">
          Headers did not match the template exactly. Choose which column is
          Colour, Size, Text, and Qty. Other columns are ignored.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATE_FIELDS.map((field) => (
          <div key={field} className="flex flex-col gap-1.5">
            <Label htmlFor={`map-${field}`} className="text-[11px] text-paper/65">
              {FIELD_LABELS[field]} <span className="text-laser">required</span>
            </Label>
            <select
              id={`map-${field}`}
              value={mapping[field] ?? ""}
              onChange={(event) =>
                onChange({
                  ...mapping,
                  [field]: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              className="h-9 rounded-lg border border-white/15 bg-charcoal px-2.5 text-sm text-paper outline-none focus-visible:border-laser focus-visible:ring-3 focus-visible:ring-laser/40"
            >
              <option value="">Choose column…</option>
              {document.headers.map((header, index) => (
                <option key={`${header}-${index}`} value={index}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {previewRows.length > 0 ? (
        <div className="overflow-x-auto border border-white/10">
          <table className="w-full min-w-[32rem] text-left text-xs">
            <caption className="sr-only">First rows from the uploaded file</caption>
            <thead className="bg-white/5 font-mono text-[10px] tracking-[0.14em] text-paper/50 uppercase">
              <tr>
                {document.headers.map((header, index) => (
                  <th key={`${header}-${index}`} className="px-3 py-2 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-white/10 text-paper/80">
                  {document.headers.map((_, index) => (
                    <td key={index} className="px-3 py-2 whitespace-nowrap">
                      {row[index] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
