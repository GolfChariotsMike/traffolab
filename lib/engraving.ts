export const engravingSrc = "/videos/traffolyte-engraving.mp4";
export const engravingPoster = "/videos/traffolyte-engraving-poster.jpg";

export type SellPoint = {
  id: string;
  side: "left" | "right";
  /** Inclusive start of the global scroll band [0,1]. Stays visible after this. */
  appear: number;
  title: string;
  detail?: string;
};

export function isCalloutRevealed(progress: number, point: SellPoint) {
  return progress >= point.appear;
}

export const sellPoints: SellPoint[] = [
  {
    id: "01",
    side: "left",
    appear: 0,
    title: "No minimum",
    detail: "Easy instant online ordering",
  },
  {
    id: "02",
    side: "right",
    appear: 0.2,
    title: "Engraved finish, not printed",
    detail: "Won’t rub off like stickers",
  },
  {
    id: "03",
    side: "left",
    appear: 0.41,
    title: "3M adhesive option",
  },
  {
    id: "04",
    side: "right",
    appear: 0.6,
    title: "100% owned & manufactured in Australia",
  },
  {
    id: "05",
    side: "left",
    appear: 0.8,
    title: "Bulk discounts",
  },
];

export const useCases = [
  "Switchboards",
  "Cable tags",
  "AC and plant",
  "Solar / PV",
  "Valve tags",
  "Control panels",
] as const;
