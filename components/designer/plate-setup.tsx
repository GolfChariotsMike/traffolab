"use client";

import { useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  COLOUR_PAIRS,
  MAX_PLATE_HEIGHT_MM,
  MAX_PLATE_WIDTH_MM,
  MIN_PLATE_MM,
  SIZE_PRESETS,
  clampDesignerPlateAxis,
  exactSizePreset,
  type ColourPairId,
  type LabelDesign,
} from "@/lib/label-design";
import {
  PLATE_RATE_TABLE,
  formatAreaMm2,
  formatAud,
  priceForPlate,
} from "@/lib/pricing";

export function PlateSetup({
  design,
  onSize,
  onColour,
  onAdhesive,
}: {
  design: LabelDesign;
  onSize: (widthMm: number, heightMm: number) => void;
  onColour: (colourPair: ColourPairId) => void;
  onAdhesive: (adhesive3m: boolean) => void;
}) {
  const preset = exactSizePreset(design.widthMm, design.heightMm);
  const quote = priceForPlate(design.widthMm, design.heightMm, 1);

  return (
    <div className="flex flex-col gap-6">
      <Fieldset legend="Size">
        <div className="grid grid-cols-2 gap-2">
          {SIZE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSize(item.widthMm, item.heightMm)}
              className={cn(
                "border px-2.5 py-2 text-left font-mono text-xs tracking-wide transition-colors",
                preset === item.id
                  ? "border-laser bg-laser/15 text-paper"
                  : "border-white/10 bg-charcoal/60 text-paper/80 hover:border-white/25"
              )}
              aria-pressed={preset === item.id}
            >
              {item.label}
              <span className="mt-0.5 block text-[10px] text-paper/45">
                mm · {formatAud(priceForPlate(item.widthMm, item.heightMm, 1).unitCents)}
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MillimetreField
            id="plate-width-mm"
            label="Width (mm)"
            valueMm={design.widthMm}
            axis="width"
            onCommit={(widthMm) => onSize(widthMm, design.heightMm)}
          />
          <MillimetreField
            id="plate-height-mm"
            label="Height (mm)"
            valueMm={design.heightMm}
            axis="height"
            onCommit={(heightMm) => onSize(design.widthMm, heightMm)}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-paper/70">
          This plate{" "}
          <span className="font-mono text-laser">{formatAud(quote.unitCents)}</span>{" "}
          each · {formatAreaMm2(quote.areaMm2)} mm²
          {quote.minimumApplied
            ? ` · ${formatAud(Math.round((PLATE_RATE_TABLE[0].minimumAud ?? 0) * 100))} minimum`
            : ""}
        </p>
        <p id="plate-size-hint" className="text-[11px] leading-relaxed text-paper/45">
          Custom size or a preset. Width {MIN_PLATE_MM}–{MAX_PLATE_WIDTH_MM} mm,
          height {MIN_PLATE_MM}–{MAX_PLATE_HEIGHT_MM} mm. Price follows plate area,
          in AUD. Corners stay square.
        </p>
      </Fieldset>

      <Fieldset legend="Colour pair">
        <div className="grid grid-cols-2 gap-2">
          {(Object.values(COLOUR_PAIRS) as (typeof COLOUR_PAIRS)[ColourPairId][]).map(
            (pair) => {
              const active = design.colourPair === pair.id;
              return (
                <button
                  key={pair.id}
                  type="button"
                  onClick={() => onColour(pair.id)}
                  className={cn(
                    "flex items-center gap-2 border px-2 py-2 text-left transition-colors",
                    active
                      ? "border-laser bg-laser/15"
                      : "border-white/10 bg-charcoal/60 hover:border-white/25"
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-8 shrink-0 flex-col overflow-hidden border border-black/30"
                  >
                    <span
                      className="h-5"
                      style={{ backgroundColor: pair.face }}
                    />
                    <span
                      className="h-3"
                      style={{ backgroundColor: pair.core }}
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs text-paper">{pair.label}</span>
                    <span className="block text-[10px] text-paper/45">
                      Face / core
                    </span>
                  </span>
                </button>
              );
            }
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-paper/45">
          Face stays. Laser carves through to the core colour.
        </p>
      </Fieldset>

      <Fieldset legend="Backing">
        <div className="flex items-center justify-between gap-3 border border-white/10 bg-charcoal/60 px-3 py-2.5">
          <div>
            <Label htmlFor="adhesive-3m" className="text-sm text-paper">
              3M adhesive
            </Label>
            <p className="mt-1 text-[11px] text-paper/45">
              Stored with the job. Not priced in this step.
            </p>
          </div>
          <Switch
            id="adhesive-3m"
            checked={design.adhesive3m}
            onCheckedChange={onAdhesive}
          />
        </div>
      </Fieldset>
    </div>
  );
}

function MillimetreField({
  id,
  label,
  valueMm,
  axis,
  onCommit,
}: {
  id: string;
  label: string;
  valueMm: number;
  axis: "width" | "height";
  onCommit: (mm: number) => void;
}) {
  const [text, setText] = useState(() => String(valueMm));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(String(valueMm));
  }, [valueMm]);

  function commit(raw: string, clampOutOfRange: boolean) {
    const trimmed = raw.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      if (clampOutOfRange) setText(String(valueMm));
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      if (clampOutOfRange) setText(String(valueMm));
      return;
    }
    const max = axis === "width" ? MAX_PLATE_WIDTH_MM : MAX_PLATE_HEIGHT_MM;
    if (parsed < MIN_PLATE_MM || parsed > max) {
      if (!clampOutOfRange) return;
    }
    onCommit(clampDesignerPlateAxis(parsed, axis));
  }

  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id} className="text-[11px] text-paper/65">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={MIN_PLATE_MM}
        max={axis === "width" ? MAX_PLATE_WIDTH_MM : MAX_PLATE_HEIGHT_MM}
        step={0.1}
        value={text}
        aria-describedby="plate-size-hint"
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          commit(next, false);
        }}
        onBlur={() => {
          focused.current = false;
          if (text.trim() === String(valueMm)) {
            setText(String(valueMm));
            return;
          }
          commit(text, true);
        }}
        className="h-8 bg-charcoal font-mono"
      />
    </div>
  );
}

function Fieldset({
  legend,
  children,
}: {
  legend: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-mono text-[10px] tracking-[0.18em] text-paper/50 uppercase">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}
