export const engravingSrc = "/videos/traffolyte-engraving.mp4";
export const engravingPoster = "/videos/traffolyte-engraving-poster.jpg";

export type SellPoint = {
  id: string;
  side: "left" | "right";
  /** Scroll/video progress [0,1] when the callout pops during the laser pass. */
  appear: number;
  title: string;
  detail?: string;
};

export const sellPoints: SellPoint[] = [
  {
    id: "01",
    side: "left",
    appear: 0.16,
    title: "No minimum",
    detail: "Easy instant online ordering",
  },
  {
    id: "02",
    side: "right",
    appear: 0.3,
    title: "Engraved finish, not printed",
    detail: "Won’t rub off like stickers",
  },
  {
    id: "03",
    side: "left",
    appear: 0.44,
    title: "3M adhesive option",
  },
  {
    id: "04",
    side: "right",
    appear: 0.58,
    title: "100% owned & manufactured in Australia",
  },
  {
    id: "05",
    side: "left",
    appear: 0.72,
    title: "Bulk discounts",
  },
];
