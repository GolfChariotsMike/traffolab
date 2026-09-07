"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { ColumnMapper } from "@/components/order/column-mapper";
import { OrderPanel } from "@/components/designer/order-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  COLOUR_PAIRS,
  DESIGN_STORAGE_KEY,
  ORDER_STORAGE_KEY,
  readStoredOrderLines,
  type OrderLine,
} from "@/lib/label-design";
import {
  TEMPLATE_DOWNLOAD_PATH,
  allowedColourHint,
  allowedSizeHint,
  downloadTemplateCsv,
  headerFingerprint,
  isCompleteMapping,
  loadCsvDocument,
  orderLinesFromPreview,
  previewMappedRows,
  readStoredMapping,
  resolveMapping,
  writeStoredMapping,
  type ColumnMapping,
  type ParsedCsv,
  type PreviewRow,
} from "@/lib/order-csv";
import { routes } from "@/lib/site";

const MAX_CSV_BYTES = 1_000_000;

export function CsvUpload() {
  const router = useRouter();
  const [document, setDocument] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showMapper, setShowMapper] = useState(false);
  const [orderLines, setOrderLines] = useState<OrderLine[]>(readStoredOrderLines);
  const [addedCount, setAddedCount] = useState(0);
  const [continued, setContinued] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fingerprint = document ? headerFingerprint(document.headers) : "";
  const preview = useMemo(
    () => (document && mapping ? previewMappedRows(document, mapping) : []),
    [document, mapping]
  );
  const validRows = preview.filter((row) => row.errors.length === 0);
  const invalidRows = preview.filter((row) => row.errors.length > 0);
  const mappingReady = mapping !== null && isCompleteMapping(mapping);

  const persistLines = useCallback((next: OrderLine[]) => {
    setOrderLines(next);
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const applyMapping = useCallback(
    (next: ColumnMapping) => {
      setMapping(next);
      if (fingerprint) writeStoredMapping(fingerprint, next);
    },
    [fingerprint]
  );

  const onFile = useCallback(
    async (file: File | undefined) => {
      setFileError(null);
      setAddedCount(0);
      setContinued(false);
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
        setFileError("Upload a .csv file.");
        return;
      }
      if (file.size > MAX_CSV_BYTES) {
        setFileError("That file is larger than 1 MB. Split the schedule and try again.");
        return;
      }
      try {
        const parsed = loadCsvDocument(await file.text());
        if (parsed.rows.length === 0) {
          setFileError("No data rows found. Keep the header row and add at least one legend.");
          return;
        }
        const nextMapping = resolveMapping(
          parsed.headers,
          readStoredMapping(headerFingerprint(parsed.headers))
        );
        const autoMapped =
          isCompleteMapping(nextMapping) &&
          (headersMatchTemplate(parsed.headers) || parsed.headerless);
        setDocument(parsed);
        setFileName(file.name);
        setMapping(nextMapping);
        setShowMapper(!autoMapped);
      } catch (error) {
        setDocument(null);
        setMapping(null);
        setFileName(null);
        setFileError(error instanceof Error ? error.message : "Could not read that CSV.");
      }
    },
    []
  );

  const addToDraft = useCallback(() => {
    if (validRows.length === 0) return;
    const lines = orderLinesFromPreview(validRows);
    persistLines([...orderLines, ...lines]);
    setAddedCount(lines.length);
    setContinued(false);
    showToast(
      `${lines.length} plate${lines.length === 1 ? "" : "s"} added to order draft`
    );
  }, [orderLines, persistLines, showToast, validRows]);

  const openInDesigner = useCallback(
    (line: OrderLine) => {
      localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(line.design));
      router.push(routes.orderDesigner);
    },
    [router]
  );

  return (
    <section className="trafflabels-designer font-industrial">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:py-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4 border border-white/10 bg-charcoal/50 p-5">
            <div>
              <p className="font-mono text-[10px] tracking-[0.18em] text-laser uppercase">
                CSV schedule
              </p>
              <h2 className="mt-2 font-heading text-xl font-semibold text-paper">
                Download a template or map your own file
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-paper/65">
                Required columns: <span className="text-paper">colour, size, text, qty</span>.
                Use a colour id or a label such as Yellow / black. Sizes must be a
                preset ({allowedSizeHint()}). Use <code className="text-laser">|</code> or{" "}
                <code className="text-laser">\n</code> for a second line.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={downloadTemplateCsv}
                className="bg-laser text-charcoal hover:bg-laser/90"
              >
                <DownloadIcon data-icon="inline-start" />
                Download template
              </Button>
              <Button asChild variant="outline" className="border-white/15">
                <a href={TEMPLATE_DOWNLOAD_PATH} download>
                  Template file
                </a>
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-paper/45">
              Colours: {allowedColourHint()}.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Label htmlFor="csv-file" className="text-sm text-paper">
              Upload CSV
            </Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => void onFile(event.target.files?.[0])}
              className="h-11 cursor-pointer bg-charcoal file:text-paper"
            />
            {fileName ? (
              <p className="text-[11px] text-paper/50">Loaded {fileName}</p>
            ) : null}
            {fileError ? (
              <p className="text-sm text-red-300" role="alert">
                {fileError}
              </p>
            ) : null}
          </div>

          {document && mapping ? (
            <>
              {showMapper || !mappingReady ? (
                <ColumnMapper
                  document={document}
                  mapping={mapping}
                  onChange={applyMapping}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-charcoal/40 px-4 py-3">
                  <p className="text-sm text-paper/70">
                    Columns matched the template. {preview.length} row
                    {preview.length === 1 ? "" : "s"} ready to check.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMapper(true)}
                  >
                    Change mapping
                  </Button>
                </div>
              )}

              {mappingReady ? (
                <PreviewTable rows={preview} />
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={addToDraft}
                  disabled={validRows.length === 0}
                  className="bg-laser text-charcoal hover:bg-laser/90"
                >
                  <UploadIcon data-icon="inline-start" />
                  Add {validRows.length} valid row{validRows.length === 1 ? "" : "s"} to
                  order draft
                </Button>
                {invalidRows.length > 0 ? (
                  <p className="text-sm text-red-300">
                    {invalidRows.length} row{invalidRows.length === 1 ? "" : "s"} have
                    errors and will be skipped.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {addedCount > 0 ? (
            <p className="border border-laser/40 bg-laser/10 px-3 py-3 text-sm text-paper/85">
              Added {addedCount} plate{addedCount === 1 ? "" : "s"} to the draft in
              this browser. Stripe checkout is not live yet — use Continue when the
              list looks right.
            </p>
          ) : null}
        </div>

        <aside className="border border-white/10 p-4 lg:border-l-0">
          <h3 className="mb-4 font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
            Order draft
          </h3>
          <OrderPanel
            lines={orderLines}
            continued={continued}
            onQty={(id, qty) =>
              persistLines(
                orderLines.map((line) =>
                  line.id === id
                    ? { ...line, qty: Math.min(999, Math.max(1, Math.round(qty || 1))) }
                    : line
                )
              )
            }
            onRemove={(id) =>
              persistLines(orderLines.filter((line) => line.id !== id))
            }
            onContinue={() => setContinued(true)}
            onOpenInDesigner={openInDesigner}
          />
        </aside>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed right-4 bottom-4 z-50 border border-laser bg-charcoal px-3 py-2 text-sm text-paper shadow-lg"
        >
          {toast}
        </div>
      ) : null}
    </section>
  );
}

function headersMatchTemplate(headers: string[]) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  return (
    normalized[0] === "colour" &&
    normalized[1] === "size" &&
    normalized[2] === "text" &&
    normalized[3] === "qty"
  );
}

function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  return (
    <div className="overflow-x-auto border border-white/10">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Parsed rows and validation errors</caption>
        <thead className="bg-white/5 font-mono text-[10px] tracking-[0.14em] text-paper/50 uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Colour</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="px-3 py-2 font-medium">Text</th>
            <th className="px-3 py-2 font-medium">Qty</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const colours = row.colourPair ? COLOUR_PAIRS[row.colourPair] : null;
            return (
              <tr key={row.sourceIndex} className="border-t border-white/10 align-top">
                <td className="px-3 py-2 font-mono text-xs text-paper/45">
                  {row.sourceIndex + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {colours ? (
                      <span
                        aria-hidden
                        className="size-4 shrink-0 border border-black/30"
                        style={{ backgroundColor: colours.face }}
                      />
                    ) : null}
                    <span className="text-paper/85">{row.values.colour || "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-paper/85">
                  {row.values.size || "—"}
                </td>
                <td className="px-3 py-2 whitespace-pre-line text-paper/85">
                  {row.text || row.values.text || "—"}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-paper/85">
                  {row.values.qty || "—"}
                </td>
                <td className="px-3 py-2">
                  {row.errors.length === 0 ? (
                    <span className="text-xs text-laser">Valid</span>
                  ) : (
                    <ul className="flex flex-col gap-1 text-xs text-red-300">
                      {row.errors.map((error) => (
                        <li key={`${error.field}-${error.message}`}>{error.message}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
