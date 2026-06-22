import type { TourProductDetailViewModel } from "@/components/product-tour-static/_shared/tourProductFullPageJsonTypes";
import type { TourProductPageLocale } from "./resolveTourProductDbLocale";
import globalPolicies from "@/data/tour-policies/global-policies.json";

type FaqItem = { question?: string; answer?: string };
type ItineraryStop = {
  name?: string;
  time?: string;
  duration?: string;
  description?: string;
};

type GlobalPolicy = {
  id: string;
  category: string;
  applies_to: string[];
  title: string;
  text: string;
  i18n?: Partial<Record<string, string>>;
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
 * `data/tour-policies/global-policies.json` 에서 cross-product 정책을 텍스트로 변환.
 * 어시스턴트가 어떤 투어든 동일한 규칙을 답변에 적용할 수 있게 한다.
 */
function buildGlobalPoliciesBlock(locale?: TourProductPageLocale): string {
  const list = (globalPolicies as { policies?: GlobalPolicy[] }).policies ?? [];
  if (list.length === 0) return "";
  const lines: string[] = [];
  for (const p of list) {
    const localized = locale && p.i18n && p.i18n[locale];
    const body = localized || p.text;
    const scope = p.applies_to?.length ? ` [applies to: ${p.applies_to.join(", ")}]` : "";
    lines.push(`- ${p.title}${scope}\n  ${body}`);
  }
  return lines.join("\n\n");
}

type WhyTourWorksLike = {
  bestFor?: readonly string[];
  lessIdeal?: readonly string[];
  lessIdealFor?: readonly string[];
  routeLogicSections?: ReadonlyArray<{
    title?: string;
    items?: ReadonlyArray<{ label?: string; detail?: string }>;
  }>;
};

/** Render the authored best-fit / less-ideal / route-logic info as plain text. */
function buildFitBlock(vm: TourProductDetailViewModel): string {
  const fit = (vm as { whyTourWorks?: WhyTourWorksLike }).whyTourWorks;
  if (!fit) return "";
  const clean = (arr?: readonly string[]) =>
    (arr ?? []).map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
  const bestFor = clean(fit.bestFor);
  const lessIdeal = clean(fit.lessIdealFor ?? fit.lessIdeal);
  const routeLogic = (fit.routeLogicSections ?? [])
    .map((section) => {
      const items = (section.items ?? [])
        .map((it) => [it.label, it.detail].filter(Boolean).join(" — ").trim())
        .filter(Boolean);
      if (items.length === 0) return "";
      return `${section.title ? `${section.title}: ` : ""}${items.join("; ")}`;
    })
    .filter(Boolean);

  const parts: string[] = [];
  if (bestFor.length) parts.push(`Best for: ${bestFor.join("; ")}`);
  if (lessIdeal.length) parts.push(`Less ideal for: ${lessIdeal.join("; ")}`);
  if (routeLogic.length) parts.push(`Why this route works: ${routeLogic.join(" | ")}`);
  return parts.join("\n");
}

/**
 * Compact plain-text product context for the tour detail AI assistant (server-side).
 */
export function buildTourProductAssistantContextText(
  vm: TourProductDetailViewModel,
  locale?: TourProductPageLocale,
): string {
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

  // Best-fit / suitability — already authored per tour (bestFor / lessIdeal /
  // routeLogic). Surfacing it lets the assistant ground accessibility, pace,
  // family, and mobility recommendations instead of guessing.
  const fitBlock = buildFitBlock(vm);
  if (fitBlock) lines.push(`## Best fit (who this tour suits)\n${fitBlock}`);

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

  const policiesBlock = buildGlobalPoliciesBlock(locale);
  if (policiesBlock) {
    lines.push(
      `## Cross-product policies (apply to every tour: small group, bus, private)\nThese rules are authoritative even when not repeated on this specific page. Quote them when asked.\n\n${policiesBlock}`,
    );
  }

  lines.push(
    `\n## Rules for answers\n- Base answers only on the information above (product context + cross-product policies) and general travel common sense.\n- Cross-product policies override silence on the page — when a user asks about something covered there (e.g. child seat pricing), answer from the policy.\n- If something is not covered (e.g. exact price changes, same-day changes), say you are not sure and suggest booking or contacting support.\n- Be concise and friendly.\n- Match the user’s language when they write in a supported language.`,
  );

  return lines.join("\n\n");
}
