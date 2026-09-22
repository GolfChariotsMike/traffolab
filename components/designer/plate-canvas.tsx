"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  colourPairOf,
  LINE_HEIGHT,
  resizeHandlePoints,
  resizeTextObject,
  textAnchor,
  textLines,
  textMetrics,
  type LabelDesign,
  type ResizeHandle,
  type TextObject,
} from "@/lib/label-design";

type Point = { x: number; y: number };

type DragState =
  | { mode: "move"; id: string; offset: Point }
  | {
      mode: "resize";
      id: string;
      handle: ResizeHandle;
      start: TextObject;
      origin: Point;
    };

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

const HANDLE_LABEL: Record<ResizeHandle, string> = {
  nw: "Resize from top left",
  n: "Resize from top",
  ne: "Resize from top right",
  e: "Resize from right",
  se: "Resize from bottom right",
  s: "Resize from bottom",
  sw: "Resize from bottom left",
  w: "Resize from left",
};

export function PlateCanvas({
  design,
  selectedId,
  onSelect,
  onMove,
  onResize,
  className,
}: {
  design: LabelDesign;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onResize: (id: string, next: Pick<TextObject, "x" | "y" | "fontSize">) => void;
  className?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [scale, setScale] = useState(4);
  const [dragging, setDragging] = useState(false);
  const colours = colourPairOf(design);
  const selected = design.objects.find((object) => object.id === selectedId);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const fit = () => {
      const pad = 56;
      const next = Math.min(
        (stage.clientWidth - pad) / design.widthMm,
        (stage.clientHeight - pad) / design.heightMm,
        10
      );
      setScale(Math.max(next, 1.6));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [design.widthMm, design.heightMm]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  function clientToMm(event: { clientX: number; clientY: number }): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * design.widthMm,
      y: ((event.clientY - rect.top) / rect.height) * design.heightMm,
    };
  }

  function endDrag() {
    dragRef.current = null;
    setDragging(false);
    document.body.style.cursor = "";
  }

  function handlePointerDown(
    event: React.PointerEvent<SVGGElement>,
    object: TextObject
  ) {
    event.stopPropagation();
    event.preventDefault();
    const point = clientToMm(event);
    if (!point) return;
    onSelect(object.id);
    dragRef.current = {
      mode: "move",
      id: object.id,
      offset: { x: point.x - object.x, y: point.y - object.y },
    };
    setDragging(true);
    document.body.style.cursor = "grabbing";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleResizePointerDown(
    event: React.PointerEvent<SVGRectElement>,
    object: TextObject,
    handle: ResizeHandle
  ) {
    event.stopPropagation();
    event.preventDefault();
    const point = clientToMm(event);
    if (!point) return;
    onSelect(object.id);
    dragRef.current = {
      mode: "resize",
      id: object.id,
      handle,
      start: object,
      origin: point,
    };
    setDragging(true);
    document.body.style.cursor = HANDLE_CURSOR[handle];
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = clientToMm(event);
    if (!point) return;
    if (drag.mode === "move") {
      onMove(drag.id, point.x - drag.offset.x, point.y - drag.offset.y);
      return;
    }
    const next = resizeTextObject(
      drag.start,
      design,
      drag.handle,
      point,
      drag.origin
    );
    onResize(drag.id, next);
  }

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(244,245,247,0.05),transparent_55%),#12151a] md:min-h-[560px]",
        className
      )}
    >
      <div className="pointer-events-none absolute top-3 left-4 font-mono text-[10px] tracking-[0.16em] text-paper/45 uppercase">
        1 unit = 1 mm · square corners
      </div>
      <div className="pointer-events-none absolute top-3 right-4 font-mono text-[10px] tracking-[0.16em] text-paper/45 uppercase">
        {scale.toFixed(1)} px / mm
      </div>

      <svg
        ref={svgRef}
        role="img"
        aria-label={`Traffolyte plate ${design.widthMm} by ${design.heightMm} millimetres`}
        width={design.widthMm * scale}
        height={design.heightMm * scale}
        viewBox={`0 0 ${design.widthMm} ${design.heightMm}`}
        className="max-h-[calc(100%-2.5rem)] max-w-[calc(100%-2rem)] touch-none shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
        style={{ overflow: "visible" }}
        onPointerDown={() => onSelect(null)}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect
          x={0}
          y={0}
          width={design.widthMm}
          height={design.heightMm}
          rx={0}
          ry={0}
          fill={colours.face}
        />

        {design.objects.map((object) => (
          <TextNode
            key={object.id}
            object={object}
            fill={colours.core}
            dragging={dragging && object.id === selectedId}
            scale={scale}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}

        {selected ? (
          <ResizeHandles
            object={selected}
            scale={scale}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ) : null}
      </svg>
    </div>
  );
}

function TextNode({
  object,
  fill,
  dragging,
  scale,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  object: TextObject;
  fill: string;
  dragging: boolean;
  scale: number;
  onPointerDown: (
    event: React.PointerEvent<SVGGElement>,
    object: TextObject
  ) => void;
  onPointerMove: (event: React.PointerEvent<SVGElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const metrics = textMetrics(object);
  const lines = textLines(object.text);
  const slop = 6 / scale;

  return (
    <g
      className={cn(dragging ? "cursor-grabbing" : "cursor-grab")}
      onPointerDown={(event) => onPointerDown(event, object)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <rect
        x={metrics.left - slop}
        y={metrics.top - slop}
        width={metrics.width + slop * 2}
        height={metrics.height + slop * 2}
        fill="transparent"
      />
      <text
        x={object.x}
        y={object.y}
        fill={fill}
        fontFamily="Space Grotesk, Arial, sans-serif"
        fontSize={object.fontSize}
        fontWeight={600}
        textAnchor={textAnchor(object.align)}
        style={{ userSelect: "none" }}
      >
        {lines.map((line, index) => (
          <tspan
            key={`${object.id}-${index}`}
            x={object.x}
            dy={index === 0 ? 0 : object.fontSize * LINE_HEIGHT}
          >
            {line || " "}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function ResizeHandles({
  object,
  scale,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  object: TextObject;
  scale: number;
  onPointerDown: (
    event: React.PointerEvent<SVGRectElement>,
    object: TextObject,
    handle: ResizeHandle
  ) => void;
  onPointerMove: (event: React.PointerEvent<SVGElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const visual = Math.max(8 / scale, 0.55);
  const hit = Math.max(22 / scale, visual * 1.8);

  return (
    <g>
      {resizeHandlePoints(object).map((point) => {
        return (
          <g key={point.id} style={{ cursor: HANDLE_CURSOR[point.id] }}>
            <rect
              x={point.x - hit / 2}
              y={point.y - hit / 2}
              width={hit}
              height={hit}
              fill="transparent"
              role="button"
              aria-label={HANDLE_LABEL[point.id]}
              onPointerDown={(event) => onPointerDown(event, object, point.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
            <rect
              x={point.x - visual / 2}
              y={point.y - visual / 2}
              width={visual}
              height={visual}
              fill="#141414"
              stroke="#FEE100"
              strokeWidth={Math.max(1.25 / scale, 0.08)}
              pointerEvents="none"
            />
          </g>
        );
      })}
    </g>
  );
}
