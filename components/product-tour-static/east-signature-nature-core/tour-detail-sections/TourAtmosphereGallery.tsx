"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TourPhotoOverlay } from "@/components/tour/TourPhotoOverlay";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourAtmosphereGalleryProps = Pick<EastSignatureNatureCoreDetailViewModel, "galleryItems" | "sectionUi">;

/*
  Editorial bento collage — 5 photos in a 3×3 grid, separated by a clean cream gutter.
    [1][1][2]
    [1][1][3]
    [4][5][3]
  • Hero (1) is 2×2 — top-left, dominant
  • Right tall (3) is 1×2 — portrait-friendly slot
  • Three small tiles (2, 4, 5) keep the original 4/3 ratio
*/
const COLLAGE_TILES = [
  { col: "1 / span 2", row: "1 / span 2", objectPos: "center 35%" },
  { col: "3 / span 1", row: "1 / span 1", objectPos: "center center" },
  { col: "3 / span 1", row: "2 / span 2", objectPos: "center 50%" },
  { col: "1 / span 1", row: "3 / span 1", objectPos: "center 60%" },
  { col: "2 / span 1", row: "3 / span 1", objectPos: "center center" },
] as const;

export function TourAtmosphereGallery({ galleryItems, sectionUi }: TourAtmosphereGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

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
      if (e.key === "Escape") { e.preventDefault(); closeLightbox(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goNext(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [lightboxOpen, closeLightbox, goNext, goPrev]);

  const scrollStrip = (dir: 1 | -1) => {
    stripRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  };

  const floatItems = galleryItems.slice(0, 5);

  return (
    <>
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.atmosphereTitle}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.atmosphereSubtitle}</p>
        </div>

        {/* ── Editorial bento collage ── */}
        <div
          className="relative w-full rounded-2xl overflow-hidden bg-[#e8e2d9] p-1.5 shadow-[0_2px_6px_rgba(26,35,50,0.06),0_16px_40px_-14px_rgba(26,35,50,0.20)]"
          style={{ aspectRatio: "4/3" }}
        >
          <div
            className="grid h-full w-full"
            style={{
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: "4px",
            }}
          >
            {floatItems.map((item, i) => {
              const tile = COLLAGE_TILES[i];
              if (!tile) return null;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openLightbox(i)}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={item.alt ?? `Open photo ${i + 1}`}
                  className="group relative overflow-hidden rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                  style={{ gridColumn: tile.col, gridRow: tile.row }}
                >
                  <img
                    src={item.src}
                    alt={item.alt ?? ""}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05] tour-photo-grade tour-photo-protected"
                    style={{ objectPosition: tile.objectPos }}
                  />
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md">
                        <Play className="h-4 w-4 text-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  )}
                  <TourPhotoOverlay src={item.src} size={i === 0 ? "md" : "sm"} />
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-black/[0.05]" />
                </button>
              );
            })}
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.06]" />
        </div>

        {/* ── Thumbnail strip with nav arrows ── */}
        {galleryItems.length > 1 && (
          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollStrip(-1)}
              aria-label="Scroll gallery left"
              className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-slate-900/[0.08] shadow-sm hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" strokeWidth={2.2} />
            </button>

            <div
              ref={stripRef}
              className="flex gap-2 overflow-x-auto scrollbar-hide flex-1"
            >
              {galleryItems.map((item, index) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => openLightbox(index)}
                  className={cn(
                    "group relative flex-shrink-0 w-[84px] rounded-xl overflow-hidden",
                    "ring-1 ring-border/50 shadow-[0_1px_2px_rgba(26,35,50,0.05),0_8px_20px_-10px_rgba(26,35,50,0.20)]",
                    "transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5",
                    "hover:ring-border hover:shadow-[0_2px_4px_rgba(26,35,50,0.06),0_14px_28px_-12px_rgba(26,35,50,0.26)]",
                  )}
                >
                  <div
                    className="aspect-[4/3] relative"
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <img
                      src={item.src}
                      alt={item.alt ?? ""}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06] tour-photo-grade tour-photo-protected"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0c1622]/65 via-[#0c1622]/10 to-transparent" />
                    <div aria-hidden className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-white/10" />
                    {item.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 shadow-md">
                          <Play className="h-2.5 w-2.5 text-foreground ml-px" fill="currentColor" />
                        </div>
                      </div>
                    )}
                    <TourPhotoOverlay src={item.src} size="sm" />
                  </div>
                </button>
              ))}
              <div className="flex-shrink-0 w-1" />
            </div>

            <button
              type="button"
              onClick={() => scrollStrip(1)}
              aria-label="Scroll gallery right"
              className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-slate-900/[0.08] shadow-sm hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-foreground" strokeWidth={2.2} />
            </button>
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo gallery"
          className="fixed inset-0 z-50 bg-[#1A2332]/96 flex items-center justify-center backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div className="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
            {activeIndex + 1} / {galleryItems.length}
          </div>

          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close gallery"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/15 hover:bg-white/25 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/28 transition-colors shadow-lg"
          >
            <ChevronLeft className="h-6 w-6 text-white" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/15 hover:bg-white/28 transition-colors shadow-lg"
          >
            <ChevronRight className="h-6 w-6 text-white" strokeWidth={2} />
          </button>

          <div
            className="relative max-w-4xl max-h-[80vh] mx-16"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            <img
              src={galleryItems[activeIndex].src}
              alt={galleryItems[activeIndex].alt ?? ""}
              decoding="async"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl tour-photo-grade tour-photo-protected"
            />
            <TourPhotoOverlay src={galleryItems[activeIndex].src} size="lg" className="p-5" />
            {galleryItems[activeIndex].type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl cursor-pointer hover:scale-105 transition-transform">
                  <Play className="h-8 w-8 text-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
            {galleryItems.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={(e) => { e.stopPropagation(); setActiveIndex(index); }}
                aria-label={`View image ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                className={cn(
                  "w-10 h-7 rounded-md overflow-hidden transition-all",
                  activeIndex === index
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#1A2332]"
                    : "opacity-45 hover:opacity-75",
                )}
              >
                <img
                  src={item.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="h-full w-full object-cover tour-photo-protected"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
