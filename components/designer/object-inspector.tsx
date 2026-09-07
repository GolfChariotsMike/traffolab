"use client";

import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MAX_FONT_MM,
  MIN_FONT_MM,
  type TextAlign,
  type TextObject,
} from "@/lib/label-design";

export function ObjectInspector({
  object,
  textareaRef,
  onChange,
}: {
  object: TextObject | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (patch: Partial<TextObject>) => void;
}) {
  if (!object) {
    return (
      <div className="border border-dashed border-white/15 px-3 py-6 text-sm text-paper/55">
        Select a legend on the plate, or add text. Drag to move. Delete removes
        the selected object.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="legend-text" className="text-[11px] text-paper/65">
          Legend
        </Label>
        <Textarea
          ref={textareaRef}
          id="legend-text"
          rows={3}
          value={object.text}
          onChange={(event) => onChange({ text: event.target.value })}
          className="bg-charcoal font-industrial"
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="legend-size" className="text-[11px] text-paper/65">
            Size
          </Label>
          <Input
            id="legend-size"
            type="number"
            min={MIN_FONT_MM}
            max={MAX_FONT_MM}
            step={0.5}
            value={object.fontSize}
            onChange={(event) =>
              onChange({ fontSize: Number(event.target.value) })
            }
            className="h-7 w-20 bg-charcoal font-mono"
          />
        </div>
        <Slider
          min={MIN_FONT_MM}
          max={MAX_FONT_MM}
          step={0.5}
          value={[object.fontSize]}
          onValueChange={(value) => {
            const next = value[0];
            if (typeof next === "number") onChange({ fontSize: next });
          }}
        />
        <p className="text-[11px] text-paper/45">{object.fontSize} mm tall</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px] text-paper/65">Alignment</Label>
        <ToggleGroup
          type="single"
          value={object.align}
          onValueChange={(value) => {
            if (value === "left" || value === "center" || value === "right") {
              onChange({ align: value satisfies TextAlign });
            }
          }}
          variant="outline"
          spacing={0}
          className="w-full"
        >
          <ToggleGroupItem value="left" aria-label="Align left" className="flex-1">
            <AlignLeftIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="center"
            aria-label="Align centre"
            className="flex-1"
          >
            <AlignCenterIcon />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="right"
            aria-label="Align right"
            className="flex-1"
          >
            <AlignRightIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
