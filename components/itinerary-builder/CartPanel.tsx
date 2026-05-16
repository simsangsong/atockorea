"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Trash2, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  cart: string[]; // ordered poi_keys
  pois: MatchPoiRow[]; // all available POIs (look up by key)
  onRemove: (key: string) => void;
  onGetQuote: () => void;
  /** Phase 4d wires the actual submit — Phase 4a leaves it as no-op. */
  getQuoteEnabled?: boolean;
}

export default function CartPanel({ cart, pois, onRemove, onGetQuote, getQuoteEnabled = false }: Props) {
  const t = useTranslations("itineraryBuilder.cart");
  const [mobileOpen, setMobileOpen] = useState(false);

  const poiByKey = new Map(pois.map((p) => [p.poi_key, p]));
  const cartPois = cart.map((k) => poiByKey.get(k)).filter((x): x is MatchPoiRow => !!x);

  const totalMinutes = cartPois.reduce(
    (sum, p) => sum + (p.default_stay_minutes ?? 0),
    0
  );
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const isEmpty = cartPois.length === 0;

  // Shared list body used in both desktop side panel and mobile bottom sheet
  const listBody = (
    <>
      {isEmpty ? (
        <div className="p-6 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-slate-300" aria-hidden />
          <p className="text-sm text-slate-500">{t("empty")}</p>
        </div>
      ) : (
        <ul className="space-y-2 px-4 pb-4">
          {cartPois.map((p, idx) => (
            <li
              key={p.poi_key}
              className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-100"
            >
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-800"
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{p.name_en}</p>
                {p.name_ko ? (
                  <p className="truncate text-[11px] text-slate-500">{p.name_ko}</p>
                ) : null}
                {p.default_stay_minutes ? (
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    ~{p.default_stay_minutes} min
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => onRemove(p.poi_key)}
                aria-label={t("remove")}
                className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  const footer = !isEmpty && (
    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3">
      {totalMinutes > 0 ? (
        <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
          <span>{t("stayTotal")}</span>
          <span className="font-semibold text-slate-900">
            {hours > 0 ? `${hours}h ` : ""}{mins}m
          </span>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onGetQuote}
        disabled={!getQuoteEnabled || isEmpty}
        className="w-full rounded-full bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {t("getQuoteCta")}
      </button>
      <p className="mt-2 text-center text-[10.5px] text-slate-500">{t("getQuoteHint")}</p>
    </div>
  );

  // Desktop side panel (md+) — sticky right column
  const desktopPanel = (
    <aside
      className="hidden md:flex md:w-[360px] md:flex-shrink-0 md:flex-col md:border-l md:border-slate-200 md:bg-white"
      aria-label={t("title")}
    >
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">{t("title")}</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            {t("poiCount", { count: cartPois.length })}
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">{listBody}</div>
      {footer}
    </aside>
  );

  // Mobile bottom sheet — collapsed handle bar at bottom, expanded sheet covers ~80vh
  const mobileSheet = (
    <div className="md:hidden">
      {/* Floating handle button — always visible */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t("openLabel")}
        className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-2xl transition-transform active:scale-95"
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
        {t("title")}
        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-slate-900">
          {cartPois.length}
        </span>
      </button>

      {/* Backdrop + sheet */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">{t("title")}</h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                  {t("poiCount", { count: cartPois.length })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label={t("closeLabel")}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>
            <div className="max-h-[calc(85vh-120px)] overflow-y-auto">{listBody}</div>
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {desktopPanel}
      {mobileSheet}
    </>
  );
}
