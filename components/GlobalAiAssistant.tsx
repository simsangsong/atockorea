"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/**
 * The chat widget pulls framer-motion + the full assistant UI (~45KB). It is
 * never visible above the fold and renders `null` on most routes, so we defer
 * its chunk until after hydration on the routes that actually mount it. The
 * tiny wrapper below stays in the shared bundle; the heavy widget does not.
 */
const TourProductAiAssistantWidget = dynamic(
  () =>
    import("@/components/product-tour-static/_shared/TourProductAiAssistantWidget").then(
      (m) => m.TourProductAiAssistantWidget,
    ),
  { ssr: false, loading: () => null },
);

const HIDDEN_ROUTE_PREFIXES = [
  "/admin",
  "/api",
  "/mockup",
  "/tour-product",
];

const LOCALE_SEGMENTS = new Set(["ko", "ja", "es", "zh-CN", "zh-TW"]);

function stripLocalePrefix(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length > 0 && LOCALE_SEGMENTS.has(segments[0])) {
    return `/${segments.slice(1).join("/")}`;
  }
  return pathname;
}

export function GlobalAiAssistant() {
  const pathname = usePathname() || "/";
  const publicPathname = stripLocalePrefix(pathname);

  if (
    HIDDEN_ROUTE_PREFIXES.some(
      (prefix) => publicPathname === prefix || publicPathname.startsWith(`${prefix}/`),
    )
  ) {
    return null;
  }

  return (
    <TourProductAiAssistantWidget
      assistantScope="site"
      tourProductSlug="__site__"
      placement="global"
    />
  );
}
