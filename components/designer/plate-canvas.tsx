"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  colourPairOf,
  LINE_HEIGHT,
  textAnchor,
  textLines,
  textMetrics,
  type LabelDesign,
  type TextObject,
} from "@/lib/label-design";

type Point = { x: number; y: number };

export function PlateCanvas({
  design,
  selectedId,
  onSelect,
  onMove,
}: {
  design: LabelDesign;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(4);
  const dragRef = useRef<{
    id: string;
    offset: Point;
  } | null>(null);
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

  function handlePointerDown(
    event: React.PointerEvent<SVGGElement>,
    object: TextObject
  ) {
    event.stopPropagation();
    const point = clientToMm(event);
    if (!point) return;
    onSelect(object.id);
    dragRef.current = {
      id: object.id,
      offset: { x: point.x - object.x, y: point.y - object.y },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = clientToMm(event);
    if (!point) return;
    onMove(drag.id, point.x - drag.offset.x, point.y - drag.offset.y);
  }

  function endDrag() {
    dragRef.current = null;
  }

  return (
    <div
      ref={stageRef}
      className="relative flex min-h-[360px] flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(244,245,247,0.05),transparent_55%),#12151a] md:min-h-[560px]"
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
            selected={object.id === selectedId}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}

        {selected ? (
          <SelectionBox object={selected} />
        ) : null}
      </svg>
    </div>
  );
}

function TextNode({
  object,
  fill,
  selected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  object: TextObject;
  fill: string;
  selected: boolean;
  onPointerDown: (
    event: React.PointerEvent<SVGGElement>,
    object: TextObject
  ) => void;
  onPointerMove: (event: React.PointerEvent<SVGGElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
}) {
  const metrics = textMetrics(object);
  const lines = textLines(object.text);

  return (
    <g
      className={cn("cursor-move", selected && "cursor-grabbing")}
      onPointerDown={(event) => onPointerDown(event, object)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <rect
        x={metrics.left - 0.6}
        y={metrics.top - 0.4}
        width={metrics.width + 1.2}
        height={metrics.height + 0.8}
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

function SelectionBox({ object }: { object: TextObject }) {
  const metrics = textMetrics(object);
  return (
    <rect
      x={metrics.left - 0.8}
      y={metrics.top - 0.6}
      width={metrics.width + 1.6}
      height={metrics.height + 1.2}
      fill="none"
      stroke="#FF6A00"
      strokeWidth={0.35}
      pointerEvents="none"
    />
  );
}
