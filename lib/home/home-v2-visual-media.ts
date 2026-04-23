/**
 * Home v2 — remote imagery placeholders.
 * Unsplash `images.unsplash.com/photo-{id}-{hash}` must return 200; wrong hashes/imgix params return 404 in browser.
 * Query style: `?w=&q=&fm=jpg` (verified against live HEAD requests).
 */

/** Pexels coastal clip (hero + visual break). */
export const HOME_V2_SHARED_COASTAL_VIDEO_MP4 =
  "https://videos.pexels.com/video-files/3629519/3629519-uhd_2560_1440_30fps.mp4";

/** Hero static layer + video poster — Jeju coastal sunrise (local asset). */
export const HOME_V2_HERO_VIDEO_POSTER = "/images/home-v2/hero-jeju-sunrise.png";

/** Visual break poster — open landscape / “pace” (200 OK). */
export const HOME_V2_VISUAL_BREAK_POSTER =
  "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80&fm=jpg";

/** Best-match sample card — road / journey (200 OK). */
export const HOME_V2_BEST_MATCH_EXAMPLE_IMAGE =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80&fm=jpg";
