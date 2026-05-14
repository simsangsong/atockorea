/**
 * Collect unique image URLs from a tour detail_payload for admin thumbnail picking.
 */
export function collectProductImageCandidates(payload: Record<string, unknown>): string[] {
  const out: string[] = [];
  const add = (u: unknown) => {
    if (typeof u !== 'string') return;
    const s = u.trim();
    if (!s || out.includes(s)) return;
    out.push(s);
  };

  const hero = payload.hero as Record<string, unknown> | undefined;
  add(hero?.imageUrl);
  if (Array.isArray(hero?.images)) {
    for (const x of hero.images) add(x);
  }

  const cc = payload.catalog_card as Record<string, unknown> | undefined;
  add(cc?.thumbnail);
  add(cc?.heroImage);

  if (Array.isArray(payload.galleryItems)) {
    for (const g of payload.galleryItems as Array<Record<string, unknown>>) {
      add(g?.src);
    }
  }

  const stops = payload.itineraryStops as unknown[] | undefined;
  if (Array.isArray(stops)) {
    for (const stop of stops) {
      if (!stop || typeof stop !== 'object') continue;
      const s = stop as Record<string, unknown>;
      add(s.image);
      if (Array.isArray(s.images)) {
        for (const x of s.images) add(x);
      }
      if (Array.isArray(s.galleryItems)) {
        for (const g of s.galleryItems as Array<Record<string, unknown>>) {
          add(g?.src);
        }
      }
    }
  }

  return out;
}

/** Absolute URL for OpenGraph / DB columns when the site uses root-relative paths. */
export function toAbsoluteSiteImageUrl(href: string): string {
  if (!href) return href;
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const base = (
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.atockorea.com').replace(/\/$/, '')
  );
  if (href.startsWith('/')) return `${base}${href}`;
  return href;
}
