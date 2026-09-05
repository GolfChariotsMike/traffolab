export const engravingSrc = "/videos/traffolyte-engraving.mp4";
export const engravingPoster = "/videos/traffolyte-engraving-poster.jpg";

export type SellPoint = {
  id: string;
  side: "left" | "right";
  /** Inclusive start of the global scroll band [0,1]. */
  appear: number;
  /** Exclusive end of the band, except the last callout which holds to 1. */
  hide: number;
  title: string;
  detail?: string;
};

export function inCalloutBand(progress: number, point: SellPoint) {
  if (point.hide >= 1) return progress >= point.appear;
  return progress >= point.appear && progress < point.hide;
}

export const sellPoints: SellPoint[] = [
  {
    id: "01",
    side: "left",
    appear: 0,
    hide: 0.2,
    title: "No minimum",
    detail: "Easy instant online ordering",
  },
  {
    id: "02",
    side: "right",
    appear: 0.2,
    hide: 0.41,
    title: "Engraved finish, not printed",
    detail: "Won’t rub off like stickers",
  },
  {
    id: "03",
    side: "left",
    appear: 0.41,
    hide: 0.6,
    title: "3M adhesive option",
  },
  {
    id: "04",
    side: "right",
    appear: 0.6,
    hide: 0.8,
    title: "100% owned & manufactured in Australia",
  },
  {
    id: "05",
    side: "left",
    appear: 0.8,
    hide: 1,
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
