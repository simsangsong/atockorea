"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronUp, GripVertical, ImageIcon, MapPin, Trash2, X } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import { formatMinutes, totalDriveMinutes } from "@/lib/itinerary-builder/distance";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  cart: string[]; // ordered poi_keys
  pois: MatchPoiRow[]; // all available POIs (look up by key)
  onRemove: (key: string) => void;
  onReorder: (next: string[]) => void;
  onGetQuote: () => void;
  /** Phase 4d wires the actual submit — Phase 4a leaves it as no-op. */
  getQuoteEnabled?: boolean;
  /** Cruise track time budget in minutes (e.g. 6h cruise window = 360). */
  cruiseBudgetMinutes?: number | null;
  /** Click row → focus on map (Phase 7 UX). */
  onFocusPoi?: (poiKey: string) => void;
}

function SortableRow({
  poi,
  index,
  onRemove,
  onFocus,
  removeLabel,
}: {
  poi: MatchPoiRow;
  index: number;
  onRemove: () => void;
  onFocus?: () => void;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: poi.poi_key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const thumb = poi.default_image_url || poi.images?.[0] || null;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-200 transition-colors duration-200 ease-out hover:bg-amber-50/60 hover:ring-amber-200"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
        className="touch-none cursor-grab rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <span
        aria-hidden
        className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-micro font-bold text-amber-800"
      >
        {index + 1}
      </span>
      <span className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-slate-100">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto h-4 w-4 text-slate-400" aria-hidden />
        )}
      </span>
      <button
        type="button"
        onClick={onFocus}
        disabled={!onFocus}
        title="See on map"
        className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default"
      >
        <p className="truncate text-caption font-semibold text-slate-900">{poi.name_en}</p>
        {poi.name_ko ? (
          <p className="truncate text-micro text-slate-500">{poi.name_ko}</p>
        ) : poi.default_stay_minutes ? (
          <p className="text-micro text-slate-500">~{poi.default_stay_minutes} min</p>
        ) : null}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex-shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

export default function CartPanel({
  cart,
  pois,
  onRemove,
  onReorder,
  onGetQuote,
  getQuoteEnabled = false,
  cruiseBudgetMinutes,
  onFocusPoi,
}: Props) {
  const t = useTranslations("itineraryBuilder.cart");
  const [mobileOpen, setMobileOpen] = useState(false);

  const poiByKey = new Map(pois.map((p) => [p.poi_key, p]));
  const cartPois = cart.map((k) => poiByKey.get(k)).filter((x): x is MatchPoiRow => !!x);

  const stayMinutes = cartPois.reduce(
    (sum, p) => sum + (p.default_stay_minutes ?? 0),
    0
  );
  const driveMin = totalDriveMinutes(cartPois.map((p) => ({ lat: p.lat, lng: p.lng })));
  const totalMin = stayMinutes + driveMin;
  const overBudget =
    cruiseBudgetMinutes != null && cruiseBudgetMinutes > 0 && totalMin > cruiseBudgetMinutes;

  const isEmpty = cartPois.length === 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cart.indexOf(active.id as string);
    const newIndex = cart.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(cart, oldIndex, newIndex));
  };

  // Shared list body used in both desktop side panel and mobile bottom sheet
  const listBody = (
    <>
      {isEmpty ? (
        <div className="px-6 py-8 text-center">
          <span className="relative mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-100">
            <MapPin className="h-7 w-7 text-amber-400" aria-hidden />
          </span>
          <p className="text-caption font-bold text-slate-900">No stops yet</p>
          <p className="mt-1.5 text-micro text-slate-500">
            Tap an <span className="font-semibold text-amber-700">Add</span> button on a card above,
            or click a pin on the map.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={cart} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1.5 px-3 pb-3">
              {cartPois.map((p, idx) => (
                <SortableRow
                  key={p.poi_key}
                  poi={p}
                  index={idx}
                  onRemove={() => onRemove(p.poi_key)}
                  onFocus={onFocusPoi ? () => onFocusPoi(p.poi_key) : undefined}
                  removeLabel={t("remove")}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </>
  );

  const footer = !isEmpty && (
    <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3">
      <div className="mb-2 space-y-1 text-caption text-slate-600">
        {stayMinutes > 0 ? (
          <div className="flex items-center justify-between">
            <span>{t("stayTotal")}</span>
            <span className="font-semibold text-slate-900">{formatMinutes(stayMinutes)}</span>
          </div>
        ) : null}
        {driveMin > 0 ? (
          <div className="flex items-center justify-between">
            <span>{t("driveTotal")}</span>
            <span className="font-semibold text-slate-900">≈ {formatMinutes(driveMin)}</span>
          </div>
        ) : null}
        {totalMin > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
            <span className="font-semibold text-slate-700">{t("totalDuration")}</span>
            <span className={`font-bold ${overBudget ? "text-rose-700" : "text-slate-900"}`}>
              {formatMinutes(totalMin)}
            </span>
          </div>
        ) : null}
        {cruiseBudgetMinutes != null && cruiseBudgetMinutes > 0 ? (
          <div className="flex items-center justify-between text-micro">
            <span className="text-slate-500">{t("cruiseBudget")}</span>
            <span className={overBudget ? "font-bold text-rose-700" : "font-semibold text-slate-700"}>
              {formatMinutes(cruiseBudgetMinutes)}
            </span>
          </div>
        ) : null}
      </div>
      {overBudget ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 ring-1 ring-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" aria-hidden />
          <p className="text-micro font-semibold text-rose-700">
            {t("cruiseOverBudget", { over: formatMinutes(totalMin - (cruiseBudgetMinutes ?? 0)) })}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onGetQuote}
        disabled={!getQuoteEnabled || isEmpty}
        className={`${homeBtnPrimary} disabled:cursor-not-allowed disabled:bg-slate-300`}
      >
        {t("getQuoteCta")}
      </button>
      <p className="mt-2 text-center text-micro text-slate-500">{t("getQuoteHint")}</p>
    </div>
  );

  // Desktop side panel (md+) — sibling pane on the right of the map
  const desktopPanel = (
    <aside
      className="hidden md:flex md:w-[360px] md:flex-shrink-0 md:flex-col md:border-l md:border-slate-200 md:bg-slate-50/60 xl:w-[380px]"
      aria-label={t("title")}
    >
      <header className="border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-caption font-bold uppercase tracking-wide text-slate-900">{t("title")}</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-micro font-bold text-amber-800">
            {t("poiCount", { count: cartPois.length })}
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">{listBody}</div>
      {footer}
    </aside>
  );

  // Mobile bottom sheet — collapsed handle bar at bottom, expanded sheet covers ~85vh
  const mobileSheet = (
    <div className="md:hidden">
      {/* Floating handle button — always visible */}
      <motion.button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label={t("openLabel")}
        layoutId="itinerary-cart-shell"
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-caption font-bold text-white shadow-2xl"
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
        {t("title")}
        <motion.span
          key={cartPois.length}
          initial={{ scale: 0.7, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 24 }}
          className="rounded-full bg-amber-400 px-2 py-0.5 text-micro font-bold text-slate-900"
        >
          {cartPois.length}
        </motion.span>
      </motion.button>

      {/* Backdrop + sheet */}
      <AnimatePresence>
        {mobileOpen ? (
          <div className="fixed inset-0 z-40">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.div
              layoutId="itinerary-cart-shell"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-white shadow-2xl"
            >
              <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="block h-1 w-10 rounded-full bg-slate-200" />
                  <h2 className="text-caption font-bold uppercase tracking-wide text-slate-900">{t("title")}</h2>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-micro font-bold text-amber-800">
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
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {desktopPanel}
      {mobileSheet}
    </>
  );
}
