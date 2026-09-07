"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DownloadIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ObjectInspector } from "@/components/designer/object-inspector";
import { OrderPanel } from "@/components/designer/order-panel";
import { PlateCanvas } from "@/components/designer/plate-canvas";
import { PlateSetup } from "@/components/designer/plate-setup";
import {
  applyPlateSize,
  clamp,
  clampObjectToPlate,
  createTextObject,
  designSummary,
  downloadSvg,
  nextObjectId,
  DESIGN_STORAGE_KEY,
  ORDER_STORAGE_KEY,
  plateFilename,
  readStoredDesign,
  readStoredOrderLines,
  serializeDesignJson,
  serializeLightBurnSvg,
  type ColourPairId,
  type LabelDesign,
  type OrderLine,
  type TextObject,
} from "@/lib/label-design";
import { productName } from "@/lib/site";

export function LabelDesigner() {
  const [design, setDesign] = useState<LabelDesign>(readStoredDesign);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => readStoredDesign().objects[0]?.id ?? null
  );
  const [orderLines, setOrderLines] = useState<OrderLine[]>(readStoredOrderLines);
  const [continued, setContinued] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selected = design.objects.find((object) => object.id === selectedId) ?? null;

  useEffect(() => {
    localStorage.setItem(DESIGN_STORAGE_KEY, JSON.stringify(design));
  }, [design]);

  useEffect(() => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orderLines));
  }, [orderLines]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const updateSelected = useCallback(
    (patch: Partial<TextObject>) => {
      if (!selectedId) return;
      setDesign((current) => ({
        ...current,
        objects: current.objects.map((object) =>
          object.id === selectedId
            ? clampObjectToPlate({ ...object, ...patch }, current)
            : object
        ),
      }));
    },
    [selectedId]
  );

  const addText = useCallback(() => {
    const next = createTextObject(design, nextObjectId(design.objects));
    const nudge = (design.objects.length % 5) * 4;
    const placed = clampObjectToPlate(
      { ...next, x: next.x + nudge, y: next.y + nudge },
      design
    );
    setDesign({ ...design, objects: [...design.objects, placed] });
    setSelectedId(placed.id);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, [design]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const objects = design.objects.filter((object) => object.id !== selectedId);
    setDesign({ ...design, objects });
    setSelectedId(objects.at(-1)?.id ?? null);
  }, [design, selectedId]);

  const exportSvg = useCallback(() => {
    downloadSvg(serializeLightBurnSvg(design), plateFilename(design));
    showToast("SVG downloaded for LightBurn");
  }, [design, showToast]);

  const addToOrder = useCallback(() => {
    const line: OrderLine = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `line-${Date.now()}`,
      qty: 1,
      design,
      svg: serializeLightBurnSvg(design),
    };
    setOrderLines((current) => [...current, line]);
    setContinued(false);
    showToast("Plate added to order draft");
  }, [design, showToast]);

  const continueOrder = useCallback(() => {
    if (orderLines.length === 0) addToOrder();
    setContinued(true);
  }, [addToOrder, orderLines.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const editing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;

      if (event.key === "Escape") {
        setSelectedId(null);
        return;
      }

      if (!selectedId || editing) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
        return;
      }

      const step = event.shiftKey ? 2 : 0.5;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        updateSelected({ x: (selected?.x ?? 0) - step });
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        updateSelected({ x: (selected?.x ?? 0) + step });
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        updateSelected({ y: (selected?.y ?? 0) - step });
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        updateSelected({ y: (selected?.y ?? 0) + step });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, selected, selectedId, updateSelected]);

  const jsonPreview = useMemo(
    () => JSON.stringify(serializeDesignJson(design), null, 2),
    [design]
  );

  return (
    <section className="trafflabels-designer font-industrial">
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.18em] text-laser uppercase">
              {productName} · Perth
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">
              Plate designer
            </h2>
            <p className="mt-1 truncate text-xs text-paper/55">
              {designSummary(design)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={addText}>
              <PlusIcon data-icon="inline-start" />
              Add text
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={deleteSelected}
              disabled={!selected}
            >
              <Trash2Icon data-icon="inline-start" />
              Delete
            </Button>
            <Button type="button" variant="outline" onClick={exportSvg}>
              <DownloadIcon data-icon="inline-start" />
              Export SVG
            </Button>
            <Button type="button" onClick={addToOrder}>
              Add to order
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1440px] gap-0 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
        <aside className="order-2 border-b border-white/10 p-4 lg:order-1 lg:border-r lg:border-b-0">
          <h3 className="mb-4 font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
            Plate setup
          </h3>
          <PlateSetup
            design={design}
            onSize={(widthMm, heightMm) =>
              setDesign((current) => applyPlateSize(current, widthMm, heightMm))
            }
            onColour={(colourPair: ColourPairId) =>
              setDesign((current) => ({ ...current, colourPair }))
            }
            onAdhesive={(adhesive3m) =>
              setDesign((current) => ({ ...current, adhesive3m }))
            }
          />
        </aside>

        <PlateCanvas
          className="order-1 lg:order-2"
          design={design}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMove={(id, x, y) => {
            setSelectedId(id);
            setDesign((current) => ({
              ...current,
              objects: current.objects.map((object) =>
                object.id === id
                  ? clampObjectToPlate({ ...object, x, y }, current)
                  : object
              ),
            }));
          }}
        />

        <aside className="order-3 flex flex-col gap-8 border-t border-white/10 p-4 lg:border-t-0 lg:border-l">
          <div>
            <h3 className="mb-4 font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
              Object
            </h3>
            <ObjectInspector
              object={selected}
              textareaRef={textareaRef}
              onChange={updateSelected}
            />
          </div>
          <div>
            <h3 className="mb-4 font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
              Order draft
            </h3>
            <OrderPanel
              lines={orderLines}
              continued={continued}
              onQty={(id, qty) =>
                setOrderLines((current) =>
                  current.map((line) =>
                    line.id === id
                      ? { ...line, qty: clamp(Math.round(qty || 1), 1, 999) }
                      : line
                  )
                )
              }
              onRemove={(id) =>
                setOrderLines((current) =>
                  current.filter((line) => line.id !== id)
                )
              }
              onContinue={continueOrder}
            />
          </div>
          <details className="text-[11px] text-paper/45">
            <summary className="cursor-pointer font-mono tracking-[0.14em] uppercase">
              Job JSON
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto border border-white/10 bg-charcoal p-2 font-mono text-[10px] leading-relaxed text-paper/70">
              {jsonPreview}
            </pre>
          </details>
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
