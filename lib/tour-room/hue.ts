/**
 * Stable pastel hue per booking (T6.2 → C-D7/C-D8): the SAME person carries
 * the SAME avatar color across the guide's chat list, roster rows and action
 * sheets. Extracted from GuideConsole so the seat dashboard can share it
 * without a component-level circular import.
 */
export function roomHue(bookingId: string): number {
  let hash = 0;
  for (let i = 0; i < bookingId.length; i += 1) hash = (hash * 31 + bookingId.charCodeAt(i)) % 360;
  return hash;
}
