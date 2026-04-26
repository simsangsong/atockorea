/**
 * Keep in sync with `lib/tour-consumer-visibility.ts` (mobile bundle cannot import web root).
 */
const CONSUMER_BLOCKED_TOUR_IDS = new Set<string>([
  "97877063-e982-4754-a4d9-daa8688a5455",
  "59877dce-5425-42f4-bd59-cc4e816fdc39",
  "0288eb78-b741-4bcf-821f-523518906753",
  "d7187d55-a482-4d5c-9d5a-ab6992448d82",
  "dd4a604c-e328-4d24-b060-f6f4e31266ad",
  "357e63a6-59fd-4e55-a5f7-11d766ed1aa5",
  "b0bd462c-a1a8-4ec6-92d7-f275335f8762",
  "592ac1da-9ea2-4ac0-8cd5-26efbbf75699",
]);

const CONSUMER_BLOCKED_TOUR_SLUGS = new Set<string>([
  "busan-top-attractions-authentic-one-day-guided-tour",
  "jeju-southern-top-unesco-spots-bus-tour",
  "jeju-island-full-day-tour-cruise-passengers",
  "jeju-eastern-unesco-spots-bus-tour",
]);

function isBlockedTourSegment(seg: string): boolean {
  const s = seg.trim().toLowerCase();
  if (!s) return false;
  if (CONSUMER_BLOCKED_TOUR_IDS.has(s)) return true;
  if (CONSUMER_BLOCKED_TOUR_SLUGS.has(s)) return true;
  if (s.startsWith("private-busan-tour-discover-top-sights")) return true;
  if (s.startsWith("jeju-private-car-charter-tour")) return true;
  if (s.startsWith("busan-top-attractions-authentic-one-day-guided-tour")) return true;
  return false;
}

/** Expo Router path for tour detail; blocked SKUs → `/tours/list`. */
export function consumerTourDetailPath(id: string): string {
  if (isBlockedTourSegment(id)) return "/tours/list";
  return `/tour/${encodeURIComponent(id)}`;
}
