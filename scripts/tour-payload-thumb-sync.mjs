/**
 * Align catalog cards + hero + seo.ogImage with the first on-route itinerary image
 * when it is a site-local path (/images/...).
 */

function isOpsOrLogisticsStop(stop) {
  const pk = (stop?._poi_meta?.poi_key || "").toLowerCase();
  if (pk.startsWith("ops_")) return true;
  const name = `${stop?.name || ""} ${stop?.category || ""}`.toLowerCase();
  if (/pickup|drop-?off|dropoff|lunch|점심|픽업|하차|식사/.test(name)) return true;
  return false;
}

/** Top-level itinerary only (not nested section copies). */
export function firstCatalogImageFromPayload(data) {
  const stops = data?.itineraryStops;
  if (!Array.isArray(stops)) return null;
  for (const s of stops) {
    if (!s || typeof s !== "object") continue;
    if (isOpsOrLogisticsStop(s)) continue;
    const img = typeof s.image === "string" ? s.image.trim() : "";
    if (img.startsWith("/images/")) return img;
  }
  return null;
}

export function absoluteSiteUrlForOg(path) {
  if (typeof path !== "string") return path;
  if (!path.startsWith("/")) return path;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.atockorea.com").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

/** Returns true if any field changed. */
export function applyCatalogHeroThumbnails(data, relImage) {
  if (!relImage || typeof relImage !== "string") return false;
  let changed = false;
  if (data.catalog_card && typeof data.catalog_card === "object") {
    if (data.catalog_card.heroImage !== relImage) {
      data.catalog_card.heroImage = relImage;
      changed = true;
    }
    if (data.catalog_card.thumbnail !== relImage) {
      data.catalog_card.thumbnail = relImage;
      changed = true;
    }
  }
  if (data.hero && typeof data.hero === "object") {
    if (data.hero.imageUrl !== relImage) {
      data.hero.imageUrl = relImage;
      changed = true;
    }
    if (Array.isArray(data.hero.images)) {
      const rest = data.hero.images.filter((u) => u !== relImage);
      const next = [relImage, ...rest].slice(0, 8);
      if (JSON.stringify(next) !== JSON.stringify(data.hero.images)) {
        data.hero.images = next;
        changed = true;
      }
    }
  }
  if (data.seo && typeof data.seo === "object") {
    const og = absoluteSiteUrlForOg(relImage);
    if (typeof data.seo.ogImage === "string" && data.seo.ogImage !== og) {
      data.seo.ogImage = og;
      changed = true;
    }
  }
  return changed;
}

/**
 * Rebuild root `galleryItems` from top-level itinerary stops (skip OPS / lunch).
 * Prefers each stop's nested `galleryItems` when present; otherwise uses `image` + `images`.
 * Deduplicates by `src` while preserving route order. Drives "See the route atmosphere".
 */
export function syncRootGalleryFromItinerary(data) {
  const stops = data?.itineraryStops;
  if (!Array.isArray(stops)) return false;
  const seen = new Set();
  const collected = [];

  function rowFromGalleryItem(gi, fallbackStopName) {
    if (!gi || typeof gi !== "object") return null;
    const src = typeof gi.src === "string" ? gi.src.trim() : "";
    if (!src) return null;
    const stopName = typeof fallbackStopName === "string" ? fallbackStopName.trim() : "";
    const loc =
      typeof gi.location === "string" && gi.location.trim()
        ? gi.location.trim()
        : stopName;
    const alt =
      typeof gi.alt === "string" && gi.alt.trim()
        ? gi.alt.trim()
        : loc
          ? `${loc} — gallery`
          : "Tour photo";
    const caption =
      typeof gi.caption === "string" && gi.caption.trim()
        ? gi.caption.trim()
        : loc || "Tour photo";
    const row = {
      type: gi.type === "video" ? "video" : "photo",
      src,
      location: loc,
      alt,
      caption,
    };
    if (typeof gi.atmosphere === "string" && gi.atmosphere.trim()) {
      row.atmosphere = gi.atmosphere.trim();
    }
    return row;
  }

  function pushUnique(row) {
    if (!row || seen.has(row.src)) return;
    seen.add(row.src);
    collected.push(row);
  }

  const primaryCandidates = [];
  const secondaryRows = [];

  for (const stop of stops) {
    if (!stop || typeof stop !== "object") continue;
    if (isOpsOrLogisticsStop(stop)) continue;
    const stopName = typeof stop.name === "string" ? stop.name.trim() : "";

    if (Array.isArray(stop.galleryItems) && stop.galleryItems.length) {
      const first = rowFromGalleryItem(stop.galleryItems[0], stopName);
      if (first) primaryCandidates.push(first);
      for (let i = 1; i < stop.galleryItems.length; i++) {
        const r = rowFromGalleryItem(stop.galleryItems[i], stopName);
        if (r) secondaryRows.push(r);
      }
      continue;
    }

    const urls = [];
    if (typeof stop.image === "string" && stop.image.trim()) urls.push(stop.image.trim());
    if (Array.isArray(stop.images)) {
      for (const u of stop.images) {
        if (typeof u === "string" && u.trim()) urls.push(u.trim());
      }
    }
    if (urls.length) {
      const [firstSrc, ...rest] = urls;
      primaryCandidates.push({
        type: "photo",
        src: firstSrc,
        location: stopName,
        alt: stopName ? `${stopName} — on-route photo` : "Tour photo",
        caption: stopName || "Tour photo",
      });
      for (const src of rest) {
        secondaryRows.push({
          type: "photo",
          src,
          location: stopName,
          alt: stopName ? `${stopName} — on-route photo` : "Tour photo",
          caption: stopName || "Tour photo",
        });
      }
    }
  }

  for (const row of primaryCandidates) pushUnique(row);
  for (const row of secondaryRows) pushUnique(row);

  if (!collected.length) return false;
  const next = collected.map((item, i) => {
    const base = {
      id: i + 1,
      type: item.type || "photo",
      src: item.src,
      location: item.location,
      alt: item.alt,
      caption: item.caption,
    };
    if (item.atmosphere) base.atmosphere = item.atmosphere;
    return base;
  });
  const prev = Array.isArray(data.galleryItems) ? data.galleryItems : [];
  const prevSrcs = prev.map((g) => (typeof g?.src === "string" ? g.src : ""));
  const nextSrcs = next.map((g) => g.src);
  if (prevSrcs.length === nextSrcs.length && prevSrcs.every((s, i) => s === nextSrcs[i])) {
    return false;
  }
  data.galleryItems = next;
  return true;
}
