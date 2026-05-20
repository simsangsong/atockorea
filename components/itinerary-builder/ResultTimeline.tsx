"use client";

import { Fragment } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Car,
  Clock,
  GripVertical,
  ImageIcon,
  MapPin,
  Trash2,
} from "lucide-react";
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
import {
  driveMinutes,
  formatMinutes,
  totalDriveMinutes,
} from "@/lib/itinerary-builder/distance";
import { useActiveStop } from "@/lib/itinerary-builder/active-stop";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";

interface Props {
  cart: string[];
  pois: MatchPoiRow[];
  onRemove: (key: string) => void;
  onReorder: (next: string[]) => void;
  onGetQuote: () => void;
  /** Cruise track time budget in minutes (e.g. 6h cruise = 360). */
  cruiseBudgetMinutes?: number | null;
  /** Click thumbnail/name → focus pin on map (Phase 4 will add reverse sync). */
  onFocusPoi?: (poiKey: string) => void;
}

/**
 * V2 redesign Phase 3 — vertical itineraryStop-style result timeline.
 * Replaces `CartPanel` as the primary selection surface in the right
 * rail (lg+) and in normal flow below the sticky map on mobile.
 *
 * Structure:
 *   • dashed amber connector running left-edge through the whole stack
 *   • each stop card = sequence node + thumbnail + name + stay/category
 *     chips + remove
 *   • between cards = per-leg drive-time chip (Car icon + minutes)
 *   • footer = stay total + drive total + grand total + cruise budget
 *     (if applicable) + Get-Quote CTA (the page's sole amber primary,
 *     per V5)
 *
 * Drag-and-drop reorder preserved via `@dnd-kit`. URL state untouched —
 * `useCart()` in the parent (`BuilderShell`) owns the persistence layer.
 *
 * On Phase 4 land, hover/click on a card will fire `onFocusPoi` and
 * synchronize with the map's hovered photo pin (bi-directional sync).
 */
export default function ResultTimeline({
  cart,
  pois,
  onRemove,
  onReorder,
  onGetQuote,
  cruiseBudgetMinutes,
  onFocusPoi,
}: Props) {
  const t = useTranslations("itineraryBuilder.cart");
  const tt = useTranslations("itineraryBuilder.timeline");
  const { activeKey, setActive } = useActiveStop();

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

  return (
    <section
      className="border border-white/80 bg-white/90 px-4 py-5 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.28)] backdrop-blur-md md:px-6 md:py-6 lg:rounded-2xl"
      aria-label={t("title")}
    >
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-caption font-bold uppercase tracking-wide text-slate-900">
          {t("title")}
        </h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-micro font-bold text-amber-800">
          {t("poiCount", { count: cartPois.length })}
        </span>
      </header>

      {isEmpty ? (
        <EmptyState headline={tt("emptyHeadline")} body={tt("emptyBody")} lookLabel={tt("lookAtMap")} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={cart} strategy={verticalListSortingStrategy}>
            <ol className="relative space-y-2 pl-7">
              {/* Dashed amber connector behind the sequence nodes */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[10px] top-4 bottom-4 w-px border-l-2 border-dashed border-amber-300"
              />
              {cartPois.map((poi, idx) => (
                <Fragment key={poi.poi_key}>
                  <SortableStopCard
                    poi={poi}
                    seq={idx + 1}
                    isActive={activeKey === poi.poi_key}
                    onHover={(hover) => setActive(hover ? poi.poi_key : null, "timeline")}
                    onRemove={() => onRemove(poi.poi_key)}
                    onFocus={onFocusPoi ? () => onFocusPoi(poi.poi_key) : undefined}
                    removeLabel={t("remove")}
                  />
                  {idx < cartPois.length - 1 ? (
                    <DriveChip
                      from={cartPois[idx]}
                      to={cartPois[idx + 1]}
                      label={tt("driveBetween", {
                        duration: formatMinutes(
                          driveMinutes(
                            { lat: cartPois[idx].lat, lng: cartPois[idx].lng },
                            { lat: cartPois[idx + 1].lat, lng: cartPois[idx + 1].lng }
                          )
                        ),
                      })}
                    />
                  ) : null}
                </Fragment>
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      {!isEmpty ? (
        <Footer
          stayMinutes={stayMinutes}
          driveMin={driveMin}
          totalMin={totalMin}
          cruiseBudgetMinutes={cruiseBudgetMinutes ?? null}
          overBudget={overBudget}
          onGetQuote={onGetQuote}
          t={t}
        />
      ) : null}
    </section>
  );
}

function SortableStopCard({
  poi,
  seq,
  isActive,
  onHover,
  onRemove,
  onFocus,
  removeLabel,
}: {
  poi: MatchPoiRow;
  seq: number;
  isActive: boolean;
  onHover: (hover: boolean) => void;
  onRemove: () => void;
  onFocus?: () => void;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: poi.poi_key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const thumb = poi.default_image_url || poi.images?.[0] || null;

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-poi-card={poi.poi_key}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`relative flex items-center gap-3 rounded-2xl bg-white/70 p-2.5 backdrop-blur-sm transition-all duration-200 ease-out motion-reduce:transition-none ${
        isActive
          ? "ring-2 ring-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]"
          : "ring-1 ring-slate-200/70 hover:bg-amber-50/50 hover:ring-amber-200"
      }`}
    >
      {/* Sequence node on the connector (overlaps the dashed line) */}
      <span
        aria-hidden
        className="absolute -left-7 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold leading-none text-white shadow-[0_0_0_3px_rgba(251,191,36,0.20)] ring-2 ring-white"
      >
        {seq}
      </span>

      {/* Drag handle (subtle, hover-emphasised) */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
        className="-ml-0.5 touch-none cursor-grab rounded p-1 text-slate-300 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>

      {/* Thumbnail */}
      <button
        type="button"
        onClick={onFocus}
        disabled={!onFocus}
        title="See on map"
        className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 disabled:cursor-default"
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="absolute inset-0 m-auto h-5 w-5 text-slate-400" aria-hidden />
        )}
      </button>

      {/* Content */}
      <button
        type="button"
        onClick={onFocus}
        disabled={!onFocus}
        className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-default"
      >
        <p className="truncate text-caption font-bold leading-snug text-slate-900">
          {poi.name_en}
        </p>
        {poi.name_ko ? (
          <p className="mt-0.5 truncate text-micro text-slate-500">{poi.name_ko}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {poi.default_stay_minutes ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-micro font-semibold text-slate-700">
              <Clock className="h-2.5 w-2.5" aria-hidden />
              {poi.default_stay_minutes}m
            </span>
          ) : null}
        </div>
      </button>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="flex-shrink-0 rounded-full p-1.5 text-slate-300 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </li>
  );
}

function DriveChip({
  from,
  to,
  label,
}: {
  from: MatchPoiRow;
  to: MatchPoiRow;
  label: string;
}) {
  // Note: from/to are passed for future Phase 4 enrichment (per-leg vehicle
  // tier hint, distance KM, etc.). Today we use just the label string.
  void from;
  void to;
  return (
    <li className="relative -my-1 flex items-center pl-1" aria-hidden>
      <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-micro font-semibold text-slate-500 ring-1 ring-slate-200/70 backdrop-blur-sm">
        <Car className="h-3 w-3" aria-hidden />
        {label}
      </span>
    </li>
  );
}

function EmptyState({
  headline,
  body,
  lookLabel,
}: {
  headline: string;
  body: string;
  lookLabel: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-300/70 bg-white/50 px-5 py-10 text-center backdrop-blur-sm">
      <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <MapPin className="h-6 w-6" aria-hidden />
      </span>
      <p className="text-caption font-bold text-slate-900">{headline}</p>
      <p className="mx-auto mt-1.5 max-w-[26ch] text-micro text-slate-600">{body}</p>
      <p className="mt-3 inline-flex items-center gap-1 text-micro font-semibold text-amber-700">
        {/* Mobile: rail is below sticky map → arrow points up.
            lg+: rail is right of map → arrow points left. */}
        <ArrowUp className="h-3 w-3 lg:hidden" aria-hidden />
        <ArrowLeft className="hidden h-3 w-3 lg:inline" aria-hidden />
        {lookLabel}
      </p>
    </div>
  );
}

function Footer({
  stayMinutes,
  driveMin,
  totalMin,
  cruiseBudgetMinutes,
  overBudget,
  onGetQuote,
  t,
}: {
  stayMinutes: number;
  driveMin: number;
  totalMin: number;
  cruiseBudgetMinutes: number | null;
  overBudget: boolean;
  onGetQuote: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <dl className="mb-3 space-y-1 text-caption text-slate-600">
        {stayMinutes > 0 ? (
          <div className="flex items-center justify-between">
            <dt>{t("stayTotal")}</dt>
            <dd className="font-semibold text-slate-900">{formatMinutes(stayMinutes)}</dd>
          </div>
        ) : null}
        {driveMin > 0 ? (
          <div className="flex items-center justify-between">
            <dt>{t("driveTotal")}</dt>
            <dd className="font-semibold text-slate-900">≈ {formatMinutes(driveMin)}</dd>
          </div>
        ) : null}
        {totalMin > 0 ? (
          <div className="flex items-center justify-between border-t border-slate-200 pt-1">
            <dt className="font-semibold text-slate-700">{t("totalDuration")}</dt>
            <dd className={`font-bold ${overBudget ? "text-rose-700" : "text-slate-900"}`}>
              {formatMinutes(totalMin)}
            </dd>
          </div>
        ) : null}
        {cruiseBudgetMinutes != null && cruiseBudgetMinutes > 0 ? (
          <div className="flex items-center justify-between text-micro">
            <dt className="text-slate-500">{t("cruiseBudget")}</dt>
            <dd
              className={
                overBudget ? "font-bold text-rose-700" : "font-semibold text-slate-700"
              }
            >
              {formatMinutes(cruiseBudgetMinutes)}
            </dd>
          </div>
        ) : null}
      </dl>
      {overBudget && cruiseBudgetMinutes != null ? (
        <p className="mb-3 rounded-md bg-rose-50 px-2.5 py-1.5 text-micro font-semibold text-rose-700 ring-1 ring-rose-100">
          {t("cruiseOverBudget", {
            over: formatMinutes(totalMin - cruiseBudgetMinutes),
          })}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onGetQuote}
        className={`${homeBtnPrimary} w-full`}
      >
        {t("getQuoteCta")}
      </button>
      <p className="mt-2 text-center text-micro text-slate-500">{t("getQuoteHint")}</p>
    </div>
  );
}
