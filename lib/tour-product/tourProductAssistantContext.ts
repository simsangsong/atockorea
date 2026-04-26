import type { TourProductDetailViewModel } from "@/components/product-tour-static/_shared/tourProductFullPageJsonTypes";

type FaqItem = { question?: string; answer?: string };
type ItineraryStop = {
  name?: string;
  time?: string;
  duration?: string;
  description?: string;
};

function asFaqList(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as FaqItem[];
}

function asItineraryStops(raw: unknown): ItineraryStop[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as ItineraryStop[];
}

/**
 * Compact plain-text product context for the tour detail AI assistant (server-side).
 */
export function buildTourProductAssistantContextText(vm: TourProductDetailViewModel): string {
  const title = `${vm.headlineLine1} ${vm.headlineLine2}`.replace(/\s+/g, " ").trim();
  const { price, hero, staticQuestions } = vm;

  const lines: string[] = [];
  lines.push(`## Product name\n${title}`);
  lines.push(
    `## Price\n${price.amountLabel} ${price.currency} per ${price.per}`.trim(),
  );
  lines.push(
    `## Summary\n${hero.tagline}\n- Duration: ${hero.meta.duration}\n- Area: ${hero.meta.region}\n- Stops: ${hero.meta.stops}\n- Rating: ${hero.meta.rating} (${hero.meta.ratingStars} stars)`,
  );
  if (Array.isArray(hero.pills) && hero.pills.length > 0) {
    lines.push(`## Tags\n${hero.pills.join(", ")}`);
  }

  const glance = vm.glanceItems;
  if (Array.isArray(glance) && glance.length > 0) {
    const bits = glance
      .map((g: unknown) => {
        if (!g || typeof g !== "object") return null;
        const o = g as { label?: string; value?: string };
        if (!o.label && !o.value) return null;
        return `${o.label ?? ""}: ${o.value ?? ""}`.trim();
      })
      .filter(Boolean) as string[];
    if (bits.length) lines.push(`## At a glance\n${bits.join("\n")}`);
  }

  const stops = asItineraryStops(vm.itineraryStops).slice(0, 8);
  if (stops.length) {
    const block = stops
      .map((s, i) => {
        const head = [s.time, s.name].filter(Boolean).join(" — ");
        const sub = s.duration ? ` (${s.duration})` : "";
        const desc = s.description ? `\n  ${s.description.slice(0, 220)}${s.description.length > 220 ? "…" : ""}` : "";
        return `${i + 1}. ${head}${sub}${desc}`;
      })
      .join("\n");
    lines.push(`## Itinerary (excerpt)\n${block}`);
  }

  const faq = asFaqList(staticQuestions).slice(0, 14);
  if (faq.length) {
    const block = faq
      .map((f) => {
        const q = f.question?.trim() ?? "";
        const a = f.answer?.trim() ?? "";
        return `Q: ${q}\nA: ${a}`;
      })
      .join("\n\n");
    lines.push(`## FAQ (from this page)\n${block}`);
  }

  lines.push(
    `\n## Rules for answers\n- Base answers only on the information above and general travel common sense.\n- If something is not covered (e.g. exact price changes, same-day changes), say you are not sure and suggest booking or contacting support.\n- Be concise and friendly.\n- Match the user’s language when they write in a supported language.`,
  );

  return lines.join("\n\n");
}
