"use client";

import { usePathname } from "next/navigation";

import { TourProductAiAssistantWidget } from "@/components/product-tour-static/_shared/TourProductAiAssistantWidget";

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
