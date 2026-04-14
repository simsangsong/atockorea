import type { HomepageProductCardImages } from "@/lib/homepage-product-card-images.shared";

export function isResolvedJoinImage(data: unknown): data is Pick<HomepageProductCardImages, "join"> {
  if (data == null || typeof data !== "object") return false;
  const j = (data as { join?: unknown }).join;
  return typeof j === "string" && j.length > 0;
}

export function isResolvedHomepageProductCardImages(data: unknown): data is HomepageProductCardImages {
  if (data == null || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return typeof o.join === "string" && typeof o.private === "string" && typeof o.bus === "string";
}

/** Join URL from API payload, or `null` if payload is unusable. */
export function joinImageUrlFromHomepageProductCardApiPayload(data: unknown): string | null {
  if (isResolvedHomepageProductCardImages(data)) return data.join;
  if (isResolvedJoinImage(data)) return data.join;
  return null;
}
