"use client";

import { Fragment } from "react";
import {
  ArrowLeft,
  ArrowUp,
  Car,
  ChevronRight,
  Clock,
  GripVertical,
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
  /** Phase 10.5b — when false the CTA flips to a mailto contact gate
   *  (14+ pax non-DMZ, >28 pax DMZ, Solati under min-hours). */
  autoQuotable?: boolean;
  /** Cruise track time budget in minutes (e.g. 6h cruise = 360). */
  cruiseBudgetMinutes?: number | null;
  /** R1 — card body tap opens the shared POIDetailModal (lifted to BuilderShell). */
  onOpenDetail?: (poi: MatchPoiRow) => void;
}

/**
 * V2 redesign Phase 3 — vertical itineraryStop-style result timeline.
 * Replaces `CartPanel` as the primary selection surface in the right
 * rail (lg+) and in normal flow below the sticky map on mobile.
 *
 * Structure:
 *   • subtle slate connector running left-edge through the whole stack
 *   • each stop card = sequence node + thumbnail + name + stay/category
 *     chips + remove
 *   • between cards = per-leg drive-time chip (Car icon + minutes)
 *   • footer = stay total + drive total + grand total + cruise budget
 *     (if applicable) + Get-Quote CTA
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
  onOpenDetail,
  autoQuotable = true,
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
        <span className="rounded-full bg-white/85 px-2 py-0.5 text-micro font-bold text-slate-500 ring-1 ring-slate-200/80">
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
            <ol className="relative space-y-2 pl-9">
              {/* Subtle slate connector behind the sequence nodes (tour-detail
                  parity). Amber sequence identity now lives on the map pins. */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[17px] top-5 bottom-5 w-px bg-slate-200"
              />
              {cartPois.map((poi, idx) => (
                <Fragment key={poi.poi_key}>
                  <SortableStopCard
                    poi={poi}
                    seq={idx + 1}
                    isActive={activeKey === poi.poi_key}
                    onHover={(hover) => setActive(hover ? poi.poi_key : null, "timeline")}
                    onRemove={() => onRemove(poi.poi_key)}
                    onOpenDetail={onOpenDetail ? () => onOpenDetail(poi) : undefined}
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
          autoQuotable={autoQuotable}
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
  onOpenDetail,
  removeLabel,
}: {
  poi: MatchPoiRow;
  seq: number;
  isActive: boolean;
  onHover: (hover: boolean) => void;
  onRemove: () => void;
  onOpenDetail?: () => void;
  removeLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: poi.poi_key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  // RR4 — compose strip uses every photo the POI has (jsonb→array at runtime);
  // fall back to default_image_url, then to a slate letter thumb (no amber, V5).
  const photos =
    Array.isArray(poi.images) && poi.images.length > 0
      ? poi.images
      : poi.default_image_url
        ? [poi.default_image_url]
        : [];

  return (
    <li
      ref={setNodeRef}
      style={style}
      data-poi-card={poi.poi_key}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className="relative"
    >
      {/* Sequence node — white/slate tour-detail node. Amber sequence
          identity is carried by the map photo-pins + route line (V5/V13
          re-scope; see plan §B). */}
      <span
        aria-hidden
        className="absolute -left-9 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium tabular-nums tracking-[0.04em] text-slate-600 ring-1 ring-white"
        style={{
          background: "#ffffff",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px -4px rgba(15,23,42,0.10), inset 0 0.5px 0 rgba(255,255,255,0.9)",
        }}
      >
        {String(seq).padStart(2, "0")}
      </span>

      {/* Card body — tap opens the shared detail drawer (RR2/RR7). The body is
          a single button; the drag handle + remove are ABSOLUTE siblings (not
          nested) so gestures don't conflict. */}
      <button
        type="button"
        onClick={onOpenDetail}
        className={`group block w-full overflow-hidden rounded-2xl bg-white text-left transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px motion-reduce:transition-none ${
          isActive
            ? "shadow-[0_2px_8px_rgba(15,23,42,0.08),0_12px_28px_-6px_rgba(15,23,42,0.16)] ring-2 ring-slate-300"
            : "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-2px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.10)]"
        }`}
      >
        {/* Compose photo strip (RR1) — every image, horizontally scrollable. */}
        {photos.length > 0 ? (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-1.5 pt-3 scrollbar-hide">
            {photos.map((src, i) => (
              <span
                key={`${src}-${i}`}
                className="relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-900/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  width={80}
                  height={56}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </span>
            ))}
          </div>
        ) : (
          <div className="flex px-3 pb-1.5 pt-3">
            <span className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-2xl font-bold text-slate-300 ring-1 ring-slate-900/5">
              {(poi.name_en?.[0] ?? "?").toUpperCase()}
            </span>
          </div>
        )}

        {/* Header — duration · title · ko · category · chevron. No clock-time:
            builder has no scheduled time, only default_stay_minutes (R1 §C). */}
        <div className="px-3.5 pb-3.5 pt-2">
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              {poi.default_stay_minutes ? (
                <div className="flex items-center gap-1 text-micro text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden />
                  <span className="tabular-nums">{formatMinutes(poi.default_stay_minutes)}</span>
                </div>
              ) : null}
              <h3 className="mt-1 truncate text-caption font-semibold leading-snug tracking-tight text-slate-900">
                {poi.name_en}
              </h3>
              {poi.name_ko ? (
                <p className="mt-0.5 truncate text-micro text-slate-500">{poi.name_ko}</p>
              ) : null}
              {poi.category ? (
                <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {poi.category}
                </p>
              ) : null}
            </div>
            <ChevronRight
              className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-slate-600"
              aria-hidden
            />
          </div>
        </div>
      </button>

      {/* Drag handle — owns drag (RR7); absolute sibling so it isn't nested. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder"
        onClick={(e) => e.stopPropagation()}
        className="absolute left-2 top-2 z-10 touch-none cursor-grab rounded-full bg-white/85 p-1 text-slate-400 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm transition-colors duration-150 hover:text-slate-700 active:cursor-grabbing"
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden />
      </button>

      {/* Remove — absolute sibling top-right. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        aria-label={removeLabel}
        className="absolute right-2 top-2 z-10 rounded-full bg-white/85 p-1.5 text-slate-400 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-sm transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
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
  // Phase 10.4.1 — premium re-do. Very-light mint card floating on the
  // stone-50 page background; NO border (user direction 2026-05-29).
  // Layered shadow + slight hover lift = floating feel; mint surface
  // ties the rail's three cards together as one composition.
  // Phase 11 D29 — shade lightened to emerald-50/30 + glow ring.
  return (
    <div className="rounded-card bg-emerald-50/30 ring-1 ring-emerald-100/40 px-5 py-10 text-center shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.9)] transition-shadow duration-300 ease-out hover:shadow-[0_4px_14px_rgba(15,23,42,0.06),0_30px_64px_-20px_rgba(15,23,42,0.26),inset_0_1px_0_rgba(255,255,255,0.95)]">
      <span className="mx-auto mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-700 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_6px_14px_-4px_rgba(15,23,42,0.12)]">
        <MapPin className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <p className="text-body font-bold leading-snug tracking-tight text-slate-900">
        {headline}
      </p>
      <p className="mx-auto mt-2 max-w-[28ch] text-caption leading-relaxed text-slate-500">
        {body}
      </p>
      <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-micro font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
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
  autoQuotable,
  t,
}: {
  stayMinutes: number;
  driveMin: number;
  totalMin: number;
  cruiseBudgetMinutes: number | null;
  overBudget: boolean;
  onGetQuote: () => void;
  autoQuotable: boolean;
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
      {autoQuotable ? (
        <>
          <button
            type="button"
            onClick={onGetQuote}
            className={`${homeBtnPrimary} w-full`}
          >
            {t("getQuoteCta")}
          </button>
          <p className="mt-2 text-center text-micro text-slate-500">{t("getQuoteHint")}</p>
        </>
      ) : (
        // Phase 10.5b — out-of-scope (14+ pax non-DMZ / >28 pax DMZ /
        // Solati under min-hours). Disabled CTA + mailto gate. No DB row
        // is ever created for these requests (D4/D19 spin-off planner).
        <>
          <a
            href="mailto:contact@atockorea.com?subject=Custom%20itinerary%20quote%20request"
            className={`${homeBtnPrimary} w-full text-center`}
          >
            맞춤 견적 문의하기 · contact@atockorea.com
          </a>
          <p className="mt-2 text-center text-micro text-slate-500">
            이 일정은 그룹/일정 특수성 때문에 즉시 예약이 어렵습니다. 이메일로 빠르게 응답드릴게요.
          </p>
        </>
      )}
    </div>
  );
}
