import type { TourProductDetailViewModel } from "@/components/product-tour-static/_shared/tourProductFullPageJsonTypes";

type StaticQ = { question?: string };

/**
 * First N FAQ `question` strings for the tour-detail assistant chips (locale follows VM).
 */
export function pickAssistantQuickChipsFromViewModel(
  vm: Pick<TourProductDetailViewModel, "staticQuestions">,
  max = 4,
  maxChar = 56,
): string[] {
  const raw = vm.staticQuestions;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (out.length >= max) break;
    if (item && typeof item === "object" && "question" in item) {
      const q = String((item as StaticQ).question ?? "").trim();
      if (q) {
        out.push(q.length > maxChar ? `${q.slice(0, maxChar - 1)}…` : q);
      }
    }
  }
  return out;
}
