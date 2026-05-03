"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourAtmosphereGalleryProps = Pick<EastSignatureNatureCoreDetailViewModel, "galleryItems" | "sectionUi">;

export function TourAtmosphereGallery({ galleryItems, sectionUi }: TourAtmosphereGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const featuredItem = galleryItems[0];
  const scrollItems = galleryItems.slice(1);

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const goNext = useCallback(
    () => setActiveIndex((prev) => (prev + 1) % galleryItems.length),
    [galleryItems.length],
  );
  const goPrev = useCallback(
    () => setActiveIndex((prev) => (prev - 1 + galleryItems.length) % galleryItems.length),
    [galleryItems.length],
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.atmosphereTitle}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.atmosphereSubtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="group relative w-full aspect-[16/9] rounded-2xl overflow-hidden ring-1 ring-border/60 shadow-[0_2px_4px_rgba(26,35,50,0.06),0_18px_50px_-18px_rgba(26,35,50,0.30)] transition-all duration-500 hover:shadow-[0_3px_6px_rgba(26,35,50,0.08),0_28px_64px_-20px_rgba(26,35,50,0.38)] hover:ring-border"
        >
          <img
            src={featuredItem.src}
            alt={featuredItem.alt ?? ""}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.04]"
          />
          {/* Layered cinematic gradient — bottom dark, side warmth, soft top vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/75 via-[#0c1622]/15 via-50% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/[0.06] via-transparent to-[#0c1622]/15" />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 110% 70% at 50% 100%, rgba(12,22,34,0.30) 0%, transparent 55%)",
            }}
          />
          {/* Inner highlight rim — premium glass feel */}
          <div aria-hidden className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/15" />

          {featuredItem.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-[0_4px_12px_rgba(0,0,0,0.25),0_10px_28px_rgba(0,0,0,0.18)] transition-all duration-300 group-hover:scale-110 group-hover:bg-white">
                <Play className="h-7 w-7 text-foreground ml-1" fill="currentColor" />
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <span
              className="rounded-full px-3.5 py-1.5 text-[11.5px] font-medium tracking-[0.01em] text-foreground shadow-lg"
              style={{
                background: "rgba(255,255,255,0.94)",
                backdropFilter: "blur(10px) saturate(140%)",
                WebkitBackdropFilter: "blur(10px) saturate(140%)",
                border: "1px solid rgba(255,255,255,0.6)",
              }}
            >
              {featuredItem.location}
            </span>
          </div>
        </button>

        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:-mx-5 sm:px-5">
          {scrollItems.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => openLightbox(index + 1)}
              className="group relative flex-shrink-0 w-[110px] rounded-xl overflow-hidden ring-1 ring-border/50 shadow-[0_1px_2px_rgba(26,35,50,0.05),0_10px_24px_-12px_rgba(26,35,50,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:ring-border hover:shadow-[0_2px_4px_rgba(26,35,50,0.06),0_16px_32px_-14px_rgba(26,35,50,0.28)]"
            >
              <div className="aspect-[4/3] relative">
                <img
                  src={item.src}
                  alt={item.alt ?? ""}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/70 via-[#0c1622]/10 to-transparent" />
                <div aria-hidden className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/10" />

                {item.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/92 shadow-md">
                      <Play className="h-3 w-3 text-foreground ml-px" fill="currentColor" />
                    </div>
                  </div>
                )}

                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-semibold tracking-[0.005em] text-white truncate leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                  {item.location}
                </span>
              </div>
            </button>
          ))}
          <div className="flex-shrink-0 w-1" />
        </div>
      </div>

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          className="fixed inset-0 z-50 bg-[#1A2332]/95 flex items-center justify-center backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Counter — top-left, mirrors close button */}
          <div className="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
            {activeIndex + 1} / {galleryItems.length}
          </div>

          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close gallery"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Previous image"
            className="absolute left-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Next image"
            className="absolute right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>

          <div className="relative max-w-4xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={galleryItems[activeIndex].src}
              alt={galleryItems[activeIndex].alt ?? ""}
              decoding="async"
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl"
            />

            <div className="absolute bottom-4 left-4 right-4 text-center">
              <span className="inline-block rounded-full bg-black/40 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white">
                {galleryItems[activeIndex].location}
              </span>
            </div>

            {galleryItems[activeIndex].type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl cursor-pointer hover:scale-105 transition-transform">
                  <Play className="h-8 w-8 text-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2">
            {galleryItems.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(index);
                }}
                aria-label={`View image ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                className={cn(
                  "w-12 h-8 rounded-md overflow-hidden transition-all",
                  activeIndex === index
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#1A2332]"
                    : "opacity-50 hover:opacity-80",
                )}
              >
                <img src={item.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
