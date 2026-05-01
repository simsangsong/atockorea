"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bath, Camera, Car, Clock, Footprints, Lightbulb, Ticket, X } from "lucide-react";
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
export function TourStopDetailDrawer({ stop, open, onClose, sectionUi }: TourStopDetailDrawerProps) {
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

            {/* Scrollable body */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-6 p-5">
                {/* Header — time + name + category, color/weight only (no italic) */}
                <div>
                  {(stop.time || stop.duration) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {stop.time && <span className="font-semibold text-foreground">{stop.time}</span>}
                      {stop.time && stop.duration && <span className="text-border">·</span>}
                      {stop.duration && <span>{stop.duration}</span>}
                    </div>
                  )}
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{stop.name}</h2>
                  {stop.category && (
                    <span className="mt-2 inline-block rounded-md bg-muted/80 px-2.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {stop.category}
                    </span>
                  )}
                </div>

                {stop.description && (
                  <p className="text-sm leading-relaxed text-foreground">{stop.description}</p>
                )}

                {stop.highlights && stop.highlights.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold tracking-wide text-foreground">
                      {sectionUi.stopHighlightsHeading}
                    </h3>
                    <ul className="grid grid-cols-1 gap-2">
                      {stop.highlights.map((highlight, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(stop.timeUsed) && stop.timeUsed.length > 0 && (
                  <div className="rounded-xl border border-border/40 bg-mist-blue/70 p-4">
                    <h3 className="mb-3 text-xs font-semibold tracking-wide text-foreground">
                      {sectionUi.stopTimeUsedHeading}
                    </h3>
                    <div className="flex items-start gap-2">
                      {stop.timeUsed.map((step, i) => (
                        <div key={i} className="flex-1 text-center">
                          <div className="mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full border border-border/50 bg-white text-[11px] font-semibold text-primary shadow-sm">
                            {i + 1}
                          </div>
                          <p className="text-[11px] leading-snug text-muted-foreground">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {typeof stop.timeUsed === "string" && stop.timeUsed.trim() !== "" && (
                  <div className="rounded-xl border border-border/40 bg-mist-blue/70 p-4">
                    <h3 className="mb-2 text-xs font-semibold tracking-wide text-foreground">
                      {sectionUi.stopTimeUsedHeading}
                    </h3>
                    <p className="text-xs leading-relaxed text-muted-foreground">{stop.timeUsed}</p>
                  </div>
                )}

                {stop.whyOnRoute && (
                  <div className="flex items-start gap-3 rounded-xl border border-accent/15 bg-sand-blush/80 px-4 py-3.5">
                    <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" strokeWidth={2} />
                    <p className="text-sm leading-relaxed text-foreground">{stop.whyOnRoute}</p>
                  </div>
                )}

                {stop.visitBasics && (
                  <div className="border-t border-border/80 pt-5">
                    <h3 className="mb-3 text-xs font-semibold tracking-wide text-foreground">
                      {sectionUi.stopVisitBasicsHeading}
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {stop.visitBasics.hours && (
                        <div className="flex items-start gap-2.5">
                          <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">{sectionUi.stopVisitHoursLabel}</p>
                            <p className="mt-0.5 font-semibold text-foreground">{stop.visitBasics.hours}</p>
                          </div>
                        </div>
                      )}
                      {stop.visitBasics.admission && (
                        <div className="flex items-start gap-2.5">
                          <Ticket className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">{sectionUi.stopVisitAdmissionLabel}</p>
                            <p className="mt-0.5 font-semibold text-foreground">{stop.visitBasics.admission}</p>
                          </div>
                        </div>
                      )}
                      {stop.visitBasics.walking && (
                        <div className="flex items-start gap-2.5">
                          <Footprints className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <div>
                            <p className="text-muted-foreground">{sectionUi.stopVisitWalkingLabel}</p>
                            <p className="mt-0.5 font-semibold text-foreground">{stop.visitBasics.walking}</p>
                          </div>
                        </div>
                      )}
                      {stop.visitBasics.closed && (
                        <div className="flex items-start gap-2.5">
                          <div className="mt-0.5 h-4 w-4 flex-shrink-0 text-center text-[10px] font-bold text-muted-foreground">
                            X
                          </div>
                          <div>
                            <p className="text-muted-foreground">{sectionUi.stopVisitClosedLabel}</p>
                            <p className="mt-0.5 font-semibold text-foreground">{stop.visitBasics.closed}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {stop.convenience && (stop.convenience.restroom || stop.convenience.parking) && (
                  <div className="flex gap-5 border-t border-border/60 pt-4 text-xs">
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

                {stop.smartNotes && (stop.smartNotes.photo || stop.smartNotes.tip) && (
                  <div className="border-t border-border/80 pt-5">
                    <h3 className="mb-3 text-xs font-semibold tracking-wide text-foreground">
                      {sectionUi.stopSmartNotesHeading}
                    </h3>
                    <div className="space-y-2.5">
                      {stop.smartNotes.photo && (
                        <div className="flex items-start gap-2.5">
                          <Camera className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{sectionUi.stopSmartNotesPhotoPrefix}</span>{" "}
                            {stop.smartNotes.photo}
                          </p>
                        </div>
                      )}
                      {stop.smartNotes.tip && (
                        <div className="flex items-start gap-2.5">
                          <Lightbulb className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">{sectionUi.stopSmartNotesTipPrefix}</span>{" "}
                            {stop.smartNotes.tip}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
