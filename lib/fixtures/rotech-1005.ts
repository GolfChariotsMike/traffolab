/**
 * Proposed plate layout for TraffLabels order #1005 (Rotech Water job 10257).
 *
 * This is a review fixture only. It is not written to the live order until the
 * site can render holes, bold type, and the condensed face. The customer's
 * drawing is NTS; physical sizes stay 30 × 10 mm (ID tags) and 100 × 75 mm
 * (nameplate).
 *
 * The drawing marks a cable-tie hole with an "O" but does not dimension it.
 * ID tags use Roboto Condensed at 5 mm cap height (7.033 mm em) so a 3 mm
 * hole can sit at the drawn-looking position: centre 4 mm from the left,
 * vertically centred, with a 0.4 mm gap after the hole and a 0.4 mm right
 * margin. The nameplate stays on Arial.
 */

import { emForCapHeightMm } from "@/lib/engrave-fonts";
import {
  applyFixedTextSize,
  CAP_HEIGHT_EM,
  textBand,
  type PlateHole,
} from "@/lib/label-design";
import type { PlateObject, StoredPlate } from "@/lib/orders";

/** Proposed (not dimensioned on the drawing). */
export const ID_TAG_HOLE: PlateHole = { cx: 4, cy: 5, diameterMm: 3 };

/** Em that yields a 5 mm cap height in Roboto Condensed (1456/2048). */
export const ID_TAG_FONT_MM = emForCapHeightMm(5, "condensed");

export const ID_TAG_LEGENDS = [
  "IV-01",
  "NRV-01",
  "NRV-02",
  "FI-01",
  "SP-01",
  "MV-02",
  "MV-05",
  "MV-06",
  "MV-07",
  "MV-12",
  "MV-20",
  "MV-21",
  "MV-22",
] as const;

const NAMEPLATE_LINES: Array<{
  text: string;
  fontSize: number;
  fontWeight?: 400 | 700;
  /** Cap-top position in mm, taken from the drawing and mapped onto 75 mm. */
  capTopMm: number;
}> = [
  { text: "CENTRAL TANAMI PROJECT JOINT VENTURE", fontSize: 4.0, fontWeight: 700, capTopMm: 5.67 },
  { text: "MODEL: BW12", fontSize: 4.0, capTopMm: 17.01 },
  { text: "SERIAL NUMBER: 10257 - 20261027", fontSize: 3.3, capTopMm: 24.7 },
  { text: "NOMINAL CAPACITY: 12KL/DAY", fontSize: 3.3, capTopMm: 32.32 },
  { text: "DATE OF MANUFACTURE: 27/10/2026", fontSize: 3.3, capTopMm: 39.44 },
  { text: "POWER REQUIREMENT: 415V/240 15FLA", fontSize: 3.3, capTopMm: 47.14 },
  { text: "ROTECH WATER", fontSize: 4.2, fontWeight: 700, capTopMm: 54.1 },
  { text: "3/15 EMPLACEMENT CRES HAMILTON HILL WA 6163", fontSize: 3.3, capTopMm: 61.56 },
  { text: "PH: 08 94333060 MOB: 0418908020", fontSize: 3.3, capTopMm: 69.01 },
];

function blankTag(text: string): StoredPlate {
  return {
    widthMm: 30,
    heightMm: 10,
    qty: 1,
    unitCents: 225,
    lineCents: 225,
    colourPair: "white-black",
    colourLabel: "White / black",
    adhesive3m: false,
    text,
    holes: [ID_TAG_HOLE],
    objects: [
      {
        id: "text-1",
        text,
        x: 15,
        y: 5,
        fontSize: ID_TAG_FONT_MM,
        align: "center",
        fontFace: "condensed",
      },
    ],
  };
}

export function rotech1005IdTags(): StoredPlate[] {
  return applyFixedTextSize(
    ID_TAG_LEGENDS.map((text) => blankTag(text)),
    ID_TAG_FONT_MM
  );
}

export function rotech1005Nameplate(): StoredPlate {
  const objects: PlateObject[] = NAMEPLATE_LINES.map((line, index) => {
    const object: PlateObject = {
      id: `text-${index + 1}`,
      text: line.text,
      x: 50,
      y: Math.round((line.capTopMm + CAP_HEIGHT_EM * line.fontSize) * 10) / 10,
      fontSize: line.fontSize,
      align: "center",
    };
    if (line.fontWeight === 700) object.fontWeight = 700;
    return object;
  });
  return {
    widthMm: 100,
    heightMm: 75,
    qty: 1,
    unitCents: 2625,
    lineCents: 2625,
    colourPair: "white-black",
    colourLabel: "White / black",
    adhesive3m: false,
    text: NAMEPLATE_LINES.map((line) => line.text).join("\n"),
    objects,
  };
}

export function rotech1005Plates(): StoredPlate[] {
  return [...rotech1005IdTags(), rotech1005Nameplate()];
}

export function rotech1005TagBand() {
  return textBand({ widthMm: 30, heightMm: 10, holes: [ID_TAG_HOLE] });
}
