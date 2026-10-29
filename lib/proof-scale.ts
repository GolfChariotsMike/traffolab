/**
 * On-screen plate size. Every plate on a page shares one millimetre scale, so
 * a 40 mm plate is twice as wide as a 20 mm plate and equal millimetre text
 * looks equal. The scale is 7px per mm until the widest plate would overflow
 * the container, then every plate shrinks together.
 */

export const PROOF_PX_PER_MM = 7;

export function widestPlateMm(plates: Array<{ widthMm: number }>) {
  const positive = plates.map((plate) => plate.widthMm).filter((width) => width > 0);
  return Math.max(1, ...positive);
}

/** Pixel width of one plate inside a container of `containerPx`. */
export function proofPlatePx(
  widthMm: number,
  widestMm: number,
  containerPx: number,
  pxPerMm = PROOF_PX_PER_MM
) {
  const widest = Math.max(widestMm, widthMm, 0.1);
  const room = Math.max(containerPx, 0);
  const scale = Math.min(pxPerMm, room / widest);
  return widthMm * scale;
}

/**
 * CSS width using the page's `--proof-widest` (millimetres) and the container's
 * inline size. Pair with `container-type: inline-size` on the grid.
 */
export function proofPlateWidth(widthMm: number) {
  return `calc(${widthMm} * min(${PROOF_PX_PER_MM}px, 100cqi / var(--proof-widest, 1)))`;
}
