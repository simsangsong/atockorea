/** Shared defaults and validation for homepage product cards (safe for client + server). */

/**
 * Defaults when `site_settings` has no URL (admin can override per card).
 * join: 제주 동부 유네스코 투어 커버(투어 카드와 동일 `public/images/tours/jeju-eastern-unesco-cover.png`).
 */
export const DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES = {
  join: "/images/tours/jeju-eastern-unesco-cover.png",
  /** 제주 해안 주상절리·절벽 (대포 일대 해안) */
  private:
    "https://images.unsplash.com/photo-1752564059684-002a6f00cd4f?auto=format&fit=crop&w=1600&q=80",
  /** 부산 감천문화마을 */
  bus: "https://images.unsplash.com/photo-1546385040-d48180ede560?auto=format&fit=crop&w=1600&q=80",
} as const;

export type HomepageProductCardImages = {
  join: string;
  private: string;
  bus: string;
};

/** Empty string = clear (revert to default). Relative paths or http(s) URLs only. */
export function isAllowedHomepageImageUrl(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  if (t.startsWith("/")) return true;
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
