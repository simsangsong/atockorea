"use client";

import { Fragment, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bath,
  BookOpen,
  Camera,
  Car,
  ChevronDown,
  Clock,
  Footprints,
  Lightbulb,
  MapPin,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

/** Light-weight superset shape that both `ItineraryStop` (full) and `PortVariantStop`
 * (cruise shore-excursion subset) satisfy without conversion. The drawer renders
 * each section conditionally so missing fields silently disappear. */
export type TourStopDrawerStop = {
  number: number;
  name: string;
  category?: string;
  time?: string;
  duration?: string;
  description?: string;
  image?: string;
  /** Optional secondary photos for the hero strip and hover cycle. */
  images?: readonly string[];
  highlights?: readonly string[];
  whyOnRoute?: string;
  visitBasics?: {
    hours?: string;
    closed?: string;
    admission?: string;
    walking?: string;
  };
  convenience?: {
    restroom?: string;
    parking?: string;
  };
  smartNotes?: {
    photo?: string;
    facilities?: string;
    tip?: string;
  };
  timeUsed?: readonly string[] | string;
};

const drawerEase = [0.16, 1, 0.3, 1] as const;

/** Inline `**bold**` → `<strong>` parser. Authors write descriptions/highlights
 *  in light markdown; this turns the markers into typographic emphasis instead
 *  of rendering literal asterisks. */
function renderInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Premium-styled inline markdown for the description modal. Restraint over
 *  saturation: only the FIRST `**bold**` per paragraph reads as a key-term
 *  highlight (soft amber wash). Subsequent bolds stay as plain `<strong>` —
 *  weight only, no color noise. Measurements get tabular-nums but no underline. */
function renderModalInline(text: string): React.ReactNode[] {
  if (!text) return [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  let boldIndex = 0;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      const inner = part.slice(2, -2);
      const isFirstBold = boldIndex === 0;
      boldIndex += 1;
      const isMeasurement = /^[0-9][\d.,\s/–-]*\s*(?:m²|m|km|hr|min|%|kg|₩|\$|€|¥|°C|°F|pyeong|평)?\s*$/i.test(inner.trim());
      return (
        <strong
          key={i}
          className={cn(
            "font-semibold text-foreground",
            isMeasurement && "tabular-nums",
            isFirstBold && "rounded-[3px] bg-amber-100/55 px-[3px] py-[1px]",
          )}
        >
          {inner}
        </strong>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Splits the long-form description into readable paragraphs at natural topic
 *  transitions: end-of-sentence followed by a bold-led phrase or a numbered
 *  marker like `(1)`. Falls back to a single block for short descriptions. */
function splitDescriptionToParagraphs(text: string): string[] {
  if (!text) return [];
  const segments = text
    .split(/(?<=\.)\s+(?=\*\*|\(\d+\))/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.length > 0 ? segments : [text];
}

function CollapsibleSection({
  icon,
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-all duration-200",
        open
          ? "border-primary/20 shadow-premium-elevated"
          : "border-border/70 shadow-premium hover:border-primary/15 hover:shadow-premium-elevated",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-tight text-foreground">{title}</p>
          {meta ? (
            <p className="mt-0.5 text-[11.5px] font-medium tracking-wide text-muted-foreground">
              {meta}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300",
            open
              ? "rotate-180 bg-foreground text-white shadow-md"
              : "bg-muted/70 text-muted-foreground",
          )}
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
        </div>
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-4 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export type TourStopDetailDrawerProps = {
  stop: TourStopDrawerStop | null;
  open: boolean;
  onClose: () => void;
  sectionUi: TourProductSectionUiV1;
};

/**
 * Slides in from the right when a stop card is tapped. Shows full stop details
 * (image, description, highlights, time used, visit basics, smart notes) so the
 * user can see everything at once instead of scrolling through an inline expand.
 */
/** Compact-by-default thresholds — keep first impression clean, allow expand on demand. */
const HIGHLIGHTS_DEFAULT_COUNT = 5;
const SHORT_WHY_THRESHOLD = 140;

export function TourStopDetailDrawer({ stop, open, onClose, sectionUi }: TourStopDetailDrawerProps) {
  const [highlightsExpanded, setHighlightsExpanded] = useState(false);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [descModalOpen, setDescModalOpen] = useState(false);
  const [prevStopNumber, setPrevStopNumber] = useState(stop?.number);

  /**
   * React-recommended "adjusting state on prop change" pattern: reset compact
   * toggles synchronously during render when the user switches to a different
   * stop. Avoids the cascading-render footgun of doing this in useEffect.
   */
  if (stop?.number !== prevStopNumber) {
    setPrevStopNumber(stop?.number);
    setHighlightsExpanded(false);
    setWhyExpanded(false);
    setDescModalOpen(false);
  }

  // Esc closes the description modal first, then the drawer.
  useEffect(() => {
    if (!descModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setDescModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [descModalOpen]);

  const galleryPhotos = stop?.images && stop.images.length > 0
    ? stop.images
    : stop?.image
      ? [stop.image]
      : [];
  const stripPhotos = galleryPhotos.length > 1 ? galleryPhotos.slice(1) : [];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && stop && (
        <>
          <motion.div
            key="tour-stop-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: drawerEase }}
            className="fixed inset-0 z-[70] bg-[#0c1622]/45 backdrop-blur-[2px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            key="tour-stop-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-label={stop.name}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.42, ease: drawerEase }}
            className="fixed bottom-0 right-0 top-0 z-[71] flex w-full max-w-[520px] flex-col bg-white shadow-[0_0_60px_rgba(12,22,34,0.18)]"
          >
            {/* Hero image area with stop number badge + close button overlay */}
            <div className="relative h-56 flex-shrink-0 overflow-hidden bg-muted">
              {stop.image ? (
                <img
                  src={stop.image}
                  alt={stop.name}
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/55 via-[#0c1622]/10 to-transparent" />

              <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-foreground shadow-lg ring-[3px] ring-white/70">
                {String(stop.number).padStart(2, "0")}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>

              {stop.duration && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-md backdrop-blur-sm">
                  <Clock className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                  {stop.duration}
                </div>
              )}
            </div>

            {/* Mini gallery strip — horizontal scroll under hero (extra photos beyond cover) */}
            {stripPhotos.length > 0 && (
              <div className="flex-shrink-0 border-b border-border/50 bg-white">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-5 py-2.5">
                  {stripPhotos.map((src, i) => (
                    <div
                      key={`${src}-${i}`}
                      className="flex-shrink-0 h-16 w-24 overflow-hidden rounded-lg bg-muted ring-1 ring-border/40 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_4px_10px_-4px_rgba(26,35,50,0.16)]"
                    >
                      <img
                        src={src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                  <div className="flex-shrink-0 w-1" aria-hidden />
                </div>
              </div>
            )}

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-5 p-5">
                {/* Header — time + name + category */}
                <div>
                  {(stop.time || stop.duration) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {stop.time && <span className="font-semibold text-foreground">{stop.time}</span>}
                      {stop.time && stop.duration && <span className="text-border">·</span>}
                      {stop.duration && <span>{stop.duration}</span>}
                    </div>
                  )}
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                    {stop.name}
                  </h2>
                  {stop.category && (
                    <span className="mt-2 inline-block rounded-md bg-muted/80 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {stop.category}
                    </span>
                  )}
                </div>

                {/* Highlights — compact + premium with optional "Read full description" link */}
                {stop.highlights && stop.highlights.length > 0 && (() => {
                  const all = stop.highlights;
                  const visible = highlightsExpanded
                    ? all
                    : all.slice(0, HIGHLIGHTS_DEFAULT_COUNT);
                  const hasMore = all.length > HIGHLIGHTS_DEFAULT_COUNT;
                  return (
                    <div>
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {sectionUi.stopHighlightsHeading}
                        </h3>
                        {stop.description && (
                          <button
                            type="button"
                            onClick={() => setDescModalOpen(true)}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-primary transition-colors hover:bg-primary/[0.14]"
                          >
                            <BookOpen className="h-3 w-3" strokeWidth={2.25} />
                            {sectionUi.stopFullDescriptionTitle ?? "Full description"}
                          </button>
                        )}
                      </div>
                      <ul className="grid grid-cols-1 gap-1.5">
                        {visible.map((highlight, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-[13px] leading-[1.5] text-foreground"
                          >
                            <span
                              aria-hidden
                              className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-accent"
                            />
                            <span>{renderInlineMarkdown(highlight)}</span>
                          </li>
                        ))}
                      </ul>
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => setHighlightsExpanded((v) => !v)}
                          aria-expanded={highlightsExpanded}
                          className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary transition-colors hover:text-primary/80"
                        >
                          {highlightsExpanded ? "Show fewer" : `Show all ${all.length}`}
                          <ChevronDown
                            className={cn(
                              "h-3.5 w-3.5 transition-transform duration-200",
                              highlightsExpanded && "rotate-180",
                            )}
                            strokeWidth={2.25}
                          />
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Why on route — clamped to 3 lines for long copy, "Read more" reveals full */}
                {stop.whyOnRoute && (() => {
                  const isLong = stop.whyOnRoute.length > SHORT_WHY_THRESHOLD;
                  return (
                    <div className="flex items-start gap-3 rounded-xl border border-accent/20 bg-sand-blush/80 px-4 py-3.5">
                      <Lightbulb
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                        strokeWidth={2}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[14px] leading-relaxed text-foreground",
                            isLong && !whyExpanded && "line-clamp-3",
                          )}
                        >
                          {renderInlineMarkdown(stop.whyOnRoute)}
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            onClick={() => setWhyExpanded((v) => !v)}
                            aria-expanded={whyExpanded}
                            className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-accent transition-colors hover:text-accent/80"
                          >
                            {whyExpanded ? "Show less" : "Read more"}
                            <ChevronDown
                              className={cn(
                                "h-3 w-3 transition-transform duration-200",
                                whyExpanded && "rotate-180",
                              )}
                              strokeWidth={2.25}
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Description is no longer inline — opens via the Highlights link button as a modal popup. */}

                {/* Collapsible — Time breakdown */}
                {Array.isArray(stop.timeUsed) && stop.timeUsed.length > 0 && (
                  <CollapsibleSection
                    icon={<Clock className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopTimeUsedHeading}
                  >
                    <div className="flex items-start gap-2">
                      {stop.timeUsed.map((step, i) => (
                        <div key={i} className="flex-1 text-center">
                          <div className="mx-auto mb-2 flex h-7 w-7 items-center justify-center rounded-full border border-border/50 bg-white text-[12px] font-semibold text-primary shadow-sm">
                            {i + 1}
                          </div>
                          <p className="text-[12px] leading-snug text-foreground/80">{step}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleSection>
                )}
                {typeof stop.timeUsed === "string" && stop.timeUsed.trim() !== "" && (
                  <CollapsibleSection
                    icon={<Clock className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopTimeUsedHeading}
                  >
                    <p className="text-[14px] leading-relaxed text-foreground/85">
                      {renderInlineMarkdown(stop.timeUsed)}
                    </p>
                  </CollapsibleSection>
                )}

                {/* Collapsible — Visit basics + Convenience */}
                {(stop.visitBasics ||
                  (stop.convenience && (stop.convenience.restroom || stop.convenience.parking))) && (
                  <CollapsibleSection
                    icon={<MapPin className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopVisitBasicsHeading}
                  >
                    {stop.visitBasics && (
                      <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                        {stop.visitBasics.hours && (
                          <div className="flex items-start gap-2.5">
                            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <div>
                              <p className="text-muted-foreground">{sectionUi.stopVisitHoursLabel}</p>
                              <p className="mt-0.5 font-semibold text-foreground">
                                {stop.visitBasics.hours}
                              </p>
                            </div>
                          </div>
                        )}
                        {stop.visitBasics.admission && (
                          <div className="flex items-start gap-2.5">
                            <Ticket className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <div>
                              <p className="text-muted-foreground">
                                {sectionUi.stopVisitAdmissionLabel}
                              </p>
                              <p className="mt-0.5 font-semibold text-foreground">
                                {stop.visitBasics.admission}
                              </p>
                            </div>
                          </div>
                        )}
                        {stop.visitBasics.walking && (
                          <div className="flex items-start gap-2.5">
                            <Footprints className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                            <div>
                              <p className="text-muted-foreground">
                                {sectionUi.stopVisitWalkingLabel}
                              </p>
                              <p className="mt-0.5 font-semibold text-foreground">
                                {stop.visitBasics.walking}
                              </p>
                            </div>
                          </div>
                        )}
                        {stop.visitBasics.closed && (
                          <div className="flex items-start gap-2.5">
                            <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-center text-[10px] font-bold text-rose-500">
                              ✕
                            </div>
                            <div>
                              <p className="text-muted-foreground">{sectionUi.stopVisitClosedLabel}</p>
                              <p className="mt-0.5 font-semibold text-foreground">
                                {stop.visitBasics.closed}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {stop.convenience &&
                      (stop.convenience.restroom || stop.convenience.parking) && (
                        <div
                          className={cn(
                            "flex gap-5 text-[12.5px]",
                            stop.visitBasics ? "mt-4 border-t border-border/60 pt-4" : "",
                          )}
                        >
                          {stop.convenience.restroom && (
                            <div className="flex items-center gap-2">
                              <Bath className="h-4 w-4 text-muted-foreground" />
                              <span className="text-foreground">{stop.convenience.restroom}</span>
                            </div>
                          )}
                          {stop.convenience.parking && (
                            <div className="flex items-center gap-2">
                              <Car className="h-4 w-4 text-muted-foreground" />
                              <span className="text-foreground">{stop.convenience.parking}</span>
                            </div>
                          )}
                        </div>
                      )}
                  </CollapsibleSection>
                )}

                {/* Collapsible — Smart notes (photo + insider tip) */}
                {stop.smartNotes && (stop.smartNotes.photo || stop.smartNotes.tip) && (
                  <CollapsibleSection
                    icon={<Sparkles className="h-4 w-4" strokeWidth={2} />}
                    title={sectionUi.stopSmartNotesHeading}
                  >
                    <div className="space-y-3">
                      {stop.smartNotes.photo && (
                        <div className="flex items-start gap-2.5">
                          <Camera
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary"
                            strokeWidth={2}
                          />
                          <p className="text-[13.5px] leading-relaxed text-foreground/85">
                            <span className="font-semibold text-foreground">
                              {sectionUi.stopSmartNotesPhotoPrefix}
                            </span>{" "}
                            {renderInlineMarkdown(stop.smartNotes.photo)}
                          </p>
                        </div>
                      )}
                      {stop.smartNotes.tip && (
                        <div className="flex items-start gap-2.5">
                          <Lightbulb
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
                            strokeWidth={2}
                          />
                          <p className="text-[13.5px] leading-relaxed text-foreground/85">
                            <span className="font-semibold text-foreground">
                              {sectionUi.stopSmartNotesTipPrefix}
                            </span>{" "}
                            {renderInlineMarkdown(stop.smartNotes.tip)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            </div>
          </motion.aside>

          {/* Wikipedia-style description popup — opens from the Highlights link button */}
          <AnimatePresence>
            {descModalOpen && stop.description && (
              <>
                <motion.div
                  key="tour-stop-desc-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22, ease: drawerEase }}
                  className="fixed inset-0 z-[80] bg-[#0c1622]/60 backdrop-blur-[3px]"
                  onClick={() => setDescModalOpen(false)}
                  aria-hidden
                />
                <motion.div
                  key="tour-stop-desc-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${stop.name} — ${sectionUi.stopFullDescriptionTitle ?? "Full description"}`}
                  initial={{ opacity: 0, y: 32 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 32 }}
                  transition={{ duration: 0.32, ease: drawerEase }}
                  className={cn(
                    "fixed z-[81] flex flex-col overflow-hidden bg-white",
                    "shadow-[0_-12px_40px_rgba(12,22,34,0.18),0_-4px_12px_rgba(12,22,34,0.10)]",
                    // Mobile: bottom sheet — full width, anchored to bottom, rounded top
                    "bottom-0 left-0 right-0 max-h-[88dvh] rounded-t-2xl",
                    // Desktop (sm+): centered card
                    "sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-h-[88dvh] sm:w-[min(640px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
                    "sm:shadow-[0_30px_80px_rgba(12,22,34,0.30),0_8px_20px_rgba(12,22,34,0.18)] sm:ring-1 sm:ring-border/60",
                  )}
                >
                  {/* Mobile drag handle (visual only) */}
                  <div className="flex justify-center pt-2 pb-1 sm:hidden">
                    <span aria-hidden className="h-1 w-9 rounded-full bg-muted-foreground/30" />
                  </div>

                  {/* Modal header — title + close */}
                  <div className="relative flex flex-shrink-0 items-start justify-between gap-3 border-b border-border/60 bg-gradient-to-b from-white via-white to-muted/15 px-5 py-3.5 sm:px-6 sm:py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/85">
                        {sectionUi.stopFullDescriptionTitle ?? "Full description"}
                      </p>
                      <h3 className="mt-1 text-[17px] font-semibold tracking-tight text-foreground sm:text-[19px]">
                        {stop.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDescModalOpen(false)}
                      aria-label="Close"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground transition-all hover:bg-muted active:scale-95"
                    >
                      <X className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>

                  {/* Modal body — premium typographic description */}
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[linear-gradient(180deg,#ffffff_0%,#fdfcfa_100%)]">
                    <article className="px-5 py-5 sm:px-6 sm:py-6">
                      {splitDescriptionToParagraphs(stop.description).map((p, i) => (
                        <p
                          key={i}
                          className={cn(
                            "text-[15px] leading-[1.75] tracking-[-0.003em] text-foreground/88 break-words [overflow-wrap:anywhere] hyphens-auto",
                            i === 0 ? "first-letter:float-left first-letter:mr-2 first-letter:text-[40px] first-letter:font-semibold first-letter:leading-[0.95] first-letter:text-foreground" : "mt-4",
                          )}
                        >
                          {renderModalInline(p)}
                        </p>
                      ))}
                    </article>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
