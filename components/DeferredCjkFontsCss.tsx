"use client";

import { useEffect } from "react";

/**
 * Injects the Noto Sans JP/SC/TC + Noto Serif KR stylesheet AFTER first paint.
 *
 * The css2 response for these four families is ~517 KB gzipped (thousands of
 * unicode-range @font-face blocks). As a render-blocking <link> in <head> it
 * added seconds to FCP on 4G for every visitor (2026-07-04 Lighthouse
 * baseline), even though the woff2 chunks themselves only download when
 * matching glyphs appear. Loading it post-paint keeps the exact same families
 * and weights — CJK text renders in the system fallbacks already listed in
 * globals.css font stacks (PingFang / Hiragino / Meiryo / Malgun / YaHei…)
 * until the swap, so there is no tofu and no visual downgrade, just no more
 * render blocking.
 */
const CJK_FONTS_CSS_HREF =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+KR:wght@300;400;500;600;700;900&display=swap";

export function DeferredCjkFontsCss() {
  useEffect(() => {
    if (document.querySelector(`link[href="${CJK_FONTS_CSS_HREF}"]`)) return;

    const inject = () => {
      if (document.querySelector(`link[href="${CJK_FONTS_CSS_HREF}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CJK_FONTS_CSS_HREF;
      document.head.appendChild(link);
    };

    // F2b: gate on window `load` BEFORE waiting for idle. Post-hydration idle
    // alone still fired inside the page-load window on slow connections, so
    // the 517 KB CSS shared bandwidth with the LCP image (2026-07-04 4G
    // Lighthouse: it remained the #1 byte source during load). After `load` +
    // idle it can never compete with first paint; system CJK fallbacks cover
    // the interim exactly as before.
    let idleId: number | null = null;
    let timeoutId: number | null = null;
    const scheduleAfterLoad = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(inject, { timeout: 5000 });
      } else {
        timeoutId = window.setTimeout(inject, 1500);
      }
    };

    if (document.readyState === "complete") {
      scheduleAfterLoad();
    } else {
      window.addEventListener("load", scheduleAfterLoad, { once: true });
    }
    return () => {
      window.removeEventListener("load", scheduleAfterLoad);
      if (idleId != null) window.cancelIdleCallback(idleId);
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, []);

  return null;
}
