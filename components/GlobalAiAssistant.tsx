"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// The widget (~2k LOC) only ever renders a closed FAB until the visitor opens
// it, so SSR is pointless. Loading it lazily keeps its ~15KB gz off every
// page's first-load bundle; the idle teaser (6s) covers the lazy fetch.
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
  "/tour-mode",
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
