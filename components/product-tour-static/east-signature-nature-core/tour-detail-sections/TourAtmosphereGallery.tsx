"use client";

import { useState } from "react";
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

  const closeLightbox = () => setLightboxOpen(false);
  const goNext = () => setActiveIndex((prev) => (prev + 1) % galleryItems.length);
  const goPrev = () => setActiveIndex((prev) => (prev - 1 + galleryItems.length) % galleryItems.length);

  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.atmosphereTitle}</h2>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.atmosphereSubtitle}</p>
        </div>

        <button
          onClick={() => openLightbox(0)}
          className="group relative w-full aspect-[16/9] rounded-xl overflow-hidden card-hero transition-all duration-300 hover:shadow-premium-hero"
        >
          <img
            src={featuredItem.src}
            alt={featuredItem.alt}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/70 via-transparent to-[#1A2332]/5" />
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#1A2332]/20" />

          {featuredItem.type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:bg-white">
                <Play className="h-7 w-7 text-foreground ml-1" fill="currentColor" />
              </div>
            </div>
          )}

          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <span className="rounded-full bg-white/95 backdrop-blur-sm px-3.5 py-1.5 text-xs font-medium text-foreground shadow-lg">
              {featuredItem.location}
            </span>
          </div>
        </button>

        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
          {scrollItems.map((item, index) => (
            <button
              key={item.id}
              onClick={() => openLightbox(index + 1)}
              className="group relative flex-shrink-0 w-[100px] rounded-lg overflow-hidden shadow-premium transition-all duration-300 hover:shadow-premium-elevated"
            >
              <div className="aspect-[4/3] relative">
                <img
                  src={item.src}
                  alt={item.alt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/60 via-[#1A2332]/10 to-transparent" />

                {item.type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-md">
                      <Play className="h-3 w-3 text-foreground ml-px" fill="currentColor" />
                    </div>
                  </div>
                )}

                <span className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium text-white/95 truncate leading-tight">
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
          className="fixed inset-0 z-50 bg-[#1A2332]/95 flex items-center justify-center backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <button onClick={closeLightbox} className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
            <X className="h-5 w-5 text-white" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-white" />
          </button>

          <div className="relative max-w-4xl max-h-[80vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={galleryItems[activeIndex].src}
              alt={galleryItems[activeIndex].alt}
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
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(index);
                }}
                className={cn(
                  "w-12 h-8 rounded-md overflow-hidden transition-all",
                  activeIndex === index
                    ? "ring-2 ring-white ring-offset-2 ring-offset-[#1A2332]"
                    : "opacity-50 hover:opacity-80",
                )}
              >
                <img src={item.src} alt={item.alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
