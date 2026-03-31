import type { TourDetailViewModel } from "@/src/types/tours";

/** Same shape as hardcoded `routeStops` in TourDetailTemplateView */
export type TemplateRouteStop = {
  id: number;
  number: string;
  title: string;
  /** One-line summary on the list card (full story stays in fullDesc / drawer). */
  shortDesc: string;
  badges: string[];
  image: string;
  duration: string;
  fullDesc: string;
  highlights: string[];
  facilities: string[];
  tip: string;
  walkingLevel: string;
};

/** First line or first ~110 chars — keeps itinerary cards clean (no mid-card clipping). */
function toCardOverviewLine(desc: string, title: string): string {
  const raw = desc.trim();
  if (!raw) return title;
  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? raw;
  const oneSentence = firstLine.split(/(?<=[.!?])\s+/)[0]?.trim() || firstLine;
  const chunk = oneSentence.length <= firstLine.length ? oneSentence : firstLine;
  if (chunk.length <= 118) return chunk;
  return `${chunk.slice(0, 115).trim()}…`;
}

function firstImageUrl(tour: TourDetailViewModel): string {
  const u = tour.images?.[0]?.url;
  return typeof u === "string" && u.trim() !== "" ? u : "";
}

export function formatTemplateKrwPrice(n: number): string {
  return `₩${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(n)}`;
}

export function buildRouteStopsFromTour(tour: TourDetailViewModel): TemplateRouteStop[] {
  const fallbackImg =
    firstImageUrl(tour) ||
    "https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&h=500&fit=crop";

  const fromDetails = tour.itineraryDetails?.filter((r) => (r.activity || "").trim() !== "");
  if (fromDetails && fromDetails.length > 0) {
    return fromDetails.map((row, i) => {
      const title = (row.activity || "").trim() || `Stop ${i + 1}`;
      const desc = (row.description || "").trim();
      const img = row.images?.find((x) => typeof x === "string" && x.trim() !== "") || fallbackImg;
      return {
        id: i + 1,
        number: String(i + 1).padStart(2, "0"),
        title,
        shortDesc: toCardOverviewLine(desc, title),
        badges: ["Itinerary"],
        image: img,
        duration: (row.time || "").trim() || "—",
        fullDesc: desc || title,
        highlights: desc ? [desc] : [title],
        facilities: [],
        tip: "",
        walkingLevel: "Follow your guide on the day of the tour.",
      };
    });
  }

  const fromSchedule = tour.itinerary?.filter((r) => (r.title || "").trim() !== "");
  if (fromSchedule && fromSchedule.length > 0) {
    return fromSchedule.map((row, i) => {
      const title = (row.title || "").trim() || `Stop ${i + 1}`;
      const desc = (row.description || "").trim();
      const img = row.images?.[0] || fallbackImg;
      return {
        id: i + 1,
        number: String(i + 1).padStart(2, "0"),
        title,
        shortDesc: toCardOverviewLine(desc, title),
        badges: ["Itinerary"],
        image: img,
        duration: (row.time || "").trim() || "—",
        fullDesc: desc || title,
        highlights: desc ? [desc] : [title],
        facilities: [],
        tip: "",
        walkingLevel: "Follow your guide on the day of the tour.",
      };
    });
  }

  return [];
}

export type TemplateFaqItem = { q: string; a: string };

export function buildFaqItemsFromTour(tour: TourDetailViewModel, fallback: TemplateFaqItem[]): TemplateFaqItem[] {
  const list = tour.faqs?.filter((f) => f.question?.trim() && f.answer?.trim());
  if (list && list.length > 0) {
    return list.map((f) => ({ q: f.question.trim(), a: f.answer.trim() }));
  }
  return fallback;
}
