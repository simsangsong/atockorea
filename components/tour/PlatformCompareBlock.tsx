"use client";

import { useMemo } from "react";
import { ExternalLink } from "lucide-react";

import { useI18n, useTranslations } from "@/lib/i18n";
import {
  appendCompareUtm,
  getPlatformLabel,
  getTourCompareLinks,
  tourCompareLastCheckedAt,
} from "@/lib/tour/platform-compare-registry";

export type PlatformCompareBlockProps = {
  /** Static tour product slug used to look up external OTA URLs. */
  tourProductSlug: string;
};

/**
 * "Same tour on other platforms" — the v2 trust-by-comparison block.
 *
 * Renders nothing if the slug has no registered OTA links. The block links to
 * the same tour on Klook · GetYourGuide · Viator with UTM tracking; pricing is
 * shown when it was last verified by the ops team, otherwise omitted (no fake
 * proof). Direct-booking advantage is stated below the rows so the comparison
 * reads as confidence, not concession.
 */
export function PlatformCompareBlock({ tourProductSlug }: PlatformCompareBlockProps) {
  const t = useTranslations("tour.platformCompare");
  const { locale } = useI18n();

  const entry = useMemo(() => getTourCompareLinks(tourProductSlug), [tourProductSlug]);
  const lastChecked = useMemo(
    () => (entry ? tourCompareLastCheckedAt(entry) : null),
    [entry],
  );

  if (!entry) return null;

  const lastCheckedFormatted = lastChecked ? formatIsoDate(lastChecked, locale) : null;

  return (
    <section
      aria-labelledby="tour-platform-compare-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7"
    >
      <header className="mb-4">
        <h3
          id="tour-platform-compare-title"
          className="text-lg font-bold text-slate-900 md:text-xl"
        >
          {t("title")}
        </h3>
        <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
      </header>

      <ul className="divide-y divide-slate-100">
        {entry.links.map((link) => {
          const label = getPlatformLabel(link.platform);
          const href = appendCompareUtm(link.url, tourProductSlug);
          return (
            <li
              key={link.platform}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex items-baseline gap-3">
                <span className="text-sm font-semibold text-slate-900">{label}</span>
                {typeof link.priceUsd === "number" ? (
                  <span className="text-xs font-medium text-slate-600">
                    {t("fromUsd", { price: link.priceUsd })}
                  </span>
                ) : null}
              </div>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
              >
                {t("cta", { platform: label })}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 text-xs text-slate-500">{t("directNote")}</p>

      {lastCheckedFormatted ? (
        <p className="mt-1 text-[11px] text-slate-400">
          {t("lastChecked", { date: lastCheckedFormatted })}
        </p>
      ) : null}
    </section>
  );
}

function formatIsoDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}
