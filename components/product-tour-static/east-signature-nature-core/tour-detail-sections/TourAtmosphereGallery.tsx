"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
/* Sprint 4.7: stripRef + scrollStrip 폐기 (썸네일 strip 제거). ChevronLeft/Right는 lightbox nav arrows에서 계속 사용. */
import { cn } from "@/lib/utils";
import { TourPhotoOverlay } from "@/components/tour/TourPhotoOverlay";
import { deriveRegion } from "@/lib/tour-photo-overlay";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

/* S Tier #1 — Film grain noise (Kodak Portra 400 입자감). SVG turbulence inline dataURI,
   mix-blend-mode overlay로 사진 톤과 자연스럽게 blend. paint cost: 1회 raster, 이후 cache. */
const FILM_GRAIN_BG = "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/* S Tier #4 — Editorial pull-quote 후보 (region 기반 dynamic). Magazine spread title 임팩트. */
function buildPullQuote(region: string | null | undefined): string {
  if (!region) return "Through the lens of place.";
  /* "Notes from Busan." 같은 NYT T Magazine / Italian Vogue 스타일 캡션 */
  const titleCased = region
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return `Notes from ${titleCased}.`;
}

const LIGHTBOX_EASE = [0.22, 1, 0.36, 1] as const;
/** Open: gentle fade-up with a touch of scale + blur. Next/prev: short
 *  horizontal slide. No overshoot, no large scale jumps. */
const LIGHTBOX_VARIANTS = {
  enter: (dir: number) =>
    dir === 0
      ? { opacity: 0, scale: 0.95, x: 0, y: 24, filter: "blur(6px)" }
      : {
          opacity: 0,
          scale: 0.97,
          x: dir > 0 ? 36 : -36,
          y: 0,
          filter: "blur(4px)",
        },
  center: { opacity: 1, scale: 1, x: 0, y: 0, filter: "blur(0px)" },
  exit: (dir: number) => ({
    opacity: 0,
    scale: 0.97,
    x: dir > 0 ? -24 : dir < 0 ? 24 : 0,
    y: 0,
    filter: "blur(2px)",
  }),
} as const;

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
  /** Direction of the most recent navigation: +1 next, -1 prev, 0 initial open. */
  const [navDirection, setNavDirection] = useState<1 | -1 | 0>(0);

  const openLightbox = (index: number) => {
    setActiveIndex(index);
    setNavDirection(0);
    setLightboxOpen(true);
  };
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  const goNext = useCallback(() => {
    setNavDirection(1);
    setActiveIndex((prev) => (prev + 1) % galleryItems.length);
  }, [galleryItems.length]);
  const goPrev = useCallback(() => {
    setNavDirection(-1);
    setActiveIndex((prev) => (prev - 1 + galleryItems.length) % galleryItems.length);
  }, [galleryItems.length]);

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

  const floatItems = galleryItems.slice(0, 5);

  /* Magazine spread accent: stable per-tour issue number 좌상단 ("N° 047" Vogue 표준). */
  const issueNumber = (() => {
    const seed = (galleryItems[0]?.id ?? galleryItems[0]?.src ?? "001").toString();
    const hash = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return String((hash % 99) + 1).padStart(3, "0");
  })();

  /* S Tier #4 — Hero 사진의 region에서 pull-quote 생성 ("Notes from Busan." 식). */
  const heroRegion = deriveRegion(galleryItems[0]?.src);
  const pullQuote = buildPullQuote(heroRegion);

  return (
    <>
      <div className="space-y-3">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{sectionUi.atmosphereTitle}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed tracking-wide text-muted-foreground">{sectionUi.atmosphereSubtitle}</p>
        </div>

        {/* S Tier #3 — Section eyebrow (잡지 chapter intro): "I · VIEWS · MMXXVI" with hairlines.
            Bodoni Moda italic + tracking ↑ + 양쪽 horizontal rule. */}
        <div className="flex items-center gap-3 pt-1">
          <div aria-hidden className="h-px flex-1 bg-foreground/15" />
          <span
            className="italic font-normal uppercase text-muted-foreground"
            style={{
              fontFamily:
                "var(--font-tour-v2-serif), 'Bodoni Moda', 'Bodoni 72', Didot, 'Times New Roman', serif",
              fontSize: "10px",
              letterSpacing: "0.36em",
            }}
          >
            I · Views · MMXXVI
          </span>
          <div aria-hidden className="h-px flex-1 bg-foreground/15" />
        </div>

        {/* ── Editorial bento collage ── */}
        <div
          className="relative w-full rounded-2xl overflow-hidden bg-white shadow-[0_2px_6px_rgba(26,35,50,0.06),0_16px_40px_-14px_rgba(26,35,50,0.20)]"
          style={{ aspectRatio: "4/3" }}
        >
          {/* Sprint 4.6: cream gutter #e8e2d9 → white + gap 4→2 (Apple Photos / Klook 표준) */}
          <div
            className="grid h-full w-full"
            style={{
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "repeat(3, 1fr)",
              gap: "2px",
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
                  <Image
                    src={item.src}
                    alt={item.alt ?? ""}
                    fill
                    sizes="(min-width: 1024px) 33vw, 50vw"
                    loading={i === 0 ? "eager" : "lazy"}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05] tour-photo-protected"
                    style={{
                      objectPosition: tile.objectPos,
                      /* Magazine editorial polish — Vogue subtle (사용자 요청 2026-05-19):
                         saturation +8 / contrast +6 / brightness -1. 기존 .tour-photo-grade
                         (saturate 0.78, contrast 0.91)는 muting 효과라 bento에서만 제거하고
                         editorial polish로 교체. lightbox는 grade 그대로 유지. */
                      filter: "saturate(1.08) contrast(1.06) brightness(0.99)",
                    }}
                  />
                  {/* S Tier #1 — Film grain noise (Kodak Portra 400 입자감).
                      mix-blend-mode overlay로 사진 톤과 자연스럽게. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 mix-blend-overlay"
                    style={{ backgroundImage: FILM_GRAIN_BG, opacity: 0.15 }}
                  />
                  {/* S Tier #2 — Soft vignette (radial corner darkening — Vogue editorial 표준). */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.22) 100%)",
                    }}
                  />
                  {/* Top-fade gradient — 상단 어둠 → 하단 명확 (Vogue 표지 표준).
                      region(BUSAN) text 가독성 ↑ + 사진 시선 중앙으로 모음. */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/35 to-transparent"
                  />
                  {item.type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md">
                        <Play className="h-4 w-4 text-foreground ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  )}
                  <TourPhotoOverlay src={item.src} size={i === 0 ? "md" : "sm"} />
                  {/* S Tier #4 — Hero tile pull-quote (잡지 spread title 임팩트). 첫 사진에만. */}
                  {i === 0 && pullQuote ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute bottom-3 left-3 max-w-[58%] italic font-normal text-white/95"
                      style={{
                        fontFamily:
                          "var(--font-tour-v2-serif), 'Bodoni Moda', 'Bodoni 72', Didot, 'Times New Roman', serif",
                        fontSize: "clamp(15px, 3.8vw, 22px)",
                        lineHeight: "1.15",
                        letterSpacing: "-0.01em",
                        textShadow:
                          "0 1px 8px rgba(0,0,0,0.65), 0 0 1px rgba(0,0,0,0.55)",
                      }}
                    >
                      {pullQuote}
                    </span>
                  ) : null}
                  <div aria-hidden className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-black/[0.05]" />
                </button>
              );
            })}
          </div>
          {/* Magazine issue number — 좌상단 Bodoni italic 작게 (Vogue/Harper's "N° 047" 표준).
              z-10 으로 모든 tile 위에 떠 있되 pointer-events-none으로 클릭 통과. */}
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-2.5 z-10 italic font-normal text-white/95"
            style={{
              fontFamily:
                "var(--font-tour-v2-serif), 'Bodoni Moda', 'Bodoni 72', Didot, 'Times New Roman', serif",
              fontSize: "10px",
              letterSpacing: "0.04em",
              textShadow: "0 1px 4px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4)",
            }}
          >
            N° {issueNumber}
          </span>
          <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/[0.06]" />
        </div>

        {/* Sprint 4.7: Thumbnail strip 제거 (collage와 중복). 사용자는 bento click → lightbox로 모든 사진 탐색. */}
      </div>

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            key="atmosphere-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label="Photo gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
            onClick={closeLightbox}
          >
          <div className="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold tabular-nums text-white">
            {activeIndex + 1} / {galleryItems.length}
          </div>

          <button
            type="button"
            onClick={closeLightbox}
            aria-label="Close gallery"
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/85 hover:bg-white transition-colors"
          >
            <X className="h-5 w-5 text-foreground" />
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/85 hover:bg-white transition-colors shadow-lg"
          >
            <ChevronLeft className="h-6 w-6 text-foreground" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/85 hover:bg-white transition-colors shadow-lg"
          >
            <ChevronRight className="h-6 w-6 text-foreground" strokeWidth={2} />
          </button>

          <motion.div
            className="relative mx-4 max-h-[90vh] w-[min(95vw,1400px)] touch-pan-y sm:mx-10"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (galleryItems.length < 2) return;
              const offsetX = info.offset.x;
              const velocityX = info.velocity.x;
              if (offsetX < -70 || velocityX < -500) goNext();
              else if (offsetX > 70 || velocityX > 500) goPrev();
            }}
          >
            <AnimatePresence mode="popLayout" initial={false} custom={navDirection}>
              <motion.img
                key={activeIndex}
                src={galleryItems[activeIndex].src}
                alt={galleryItems[activeIndex].alt ?? ""}
                decoding="async"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="mx-auto block max-h-[90vh] w-auto max-w-full rounded-xl shadow-2xl tour-photo-grade tour-photo-protected"
                custom={navDirection}
                variants={LIGHTBOX_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  duration: navDirection === 0 ? 0.58 : 0.46,
                  ease: navDirection === 0 ? [0.22, 1, 0.36, 1] : LIGHTBOX_EASE,
                }}
              />
            </AnimatePresence>
            <TourPhotoOverlay src={galleryItems[activeIndex].src} size="lg" />
            {galleryItems[activeIndex].type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl cursor-pointer hover:scale-105 transition-transform">
                  <Play className="h-8 w-8 text-foreground ml-1" fill="currentColor" />
                </div>
              </div>
            )}
          </motion.div>

          <div className="absolute bottom-5 left-0 right-0 flex justify-center gap-2">
            {galleryItems.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setNavDirection(index > activeIndex ? 1 : index < activeIndex ? -1 : 0);
                  setActiveIndex(index);
                }}
                aria-label={`View image ${index + 1}`}
                aria-current={activeIndex === index ? "true" : undefined}
                className={cn(
                  "w-10 h-7 rounded-md overflow-hidden transition-all",
                  activeIndex === index
                    ? "ring-2 ring-white ring-offset-2 ring-offset-black"
                    : "opacity-45 hover:opacity-75",
                )}
              >
                <Image
                  src={item.src}
                  alt=""
                  width={40}
                  height={28}
                  sizes="40px"
                  loading="lazy"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="h-full w-full object-cover tour-photo-protected"
                />
              </button>
            ))}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
