"use client";

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
  matchSizePreset,
  type ColourPairId,
  type LabelDesign,
} from "@/lib/label-design";

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
  const preset = matchSizePreset(design.widthMm, design.heightMm);

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
            >
              {item.label}
              <span className="mt-0.5 block text-[10px] tracking-[0.12em] text-paper/45 uppercase">
                mm
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            id="plate-width"
            label="Width"
            value={design.widthMm}
            min={MIN_PLATE_MM}
            max={MAX_PLATE_WIDTH_MM}
            onChange={(widthMm) => onSize(widthMm, design.heightMm)}
          />
          <NumberField
            id="plate-height"
            label="Height"
            value={design.heightMm}
            min={MIN_PLATE_MM}
            max={MAX_PLATE_HEIGHT_MM}
            onChange={(heightMm) => onSize(design.widthMm, heightMm)}
          />
        </div>
        <p className="text-[11px] leading-relaxed text-paper/45">
          Custom size {MIN_PLATE_MM}–{MAX_PLATE_WIDTH_MM} × {MIN_PLATE_MM}–
          {MAX_PLATE_HEIGHT_MM} mm. Corners stay square.
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

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[11px] text-paper/65">
        {label} (mm)
      </Label>
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        step={1}
        value={Number.isInteger(value) ? value : value.toFixed(1)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bg-charcoal font-mono"
      />
    </div>
  );
}
