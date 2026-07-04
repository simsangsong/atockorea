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
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CJK_FONTS_CSS_HREF;
      document.head.appendChild(link);
    };

    // Wait for idle so the 517 KB CSS never competes with LCP-critical
    // resources; cap the wait so slow-but-busy devices still get the fonts.
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(inject, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(inject, 1500);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
