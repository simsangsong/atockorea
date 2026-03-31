"use client"

import { useState } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react"
import { cn } from "@/lib/utils"

const galleryImages = [
  {
    src: "https://images.unsplash.com/photo-1548115184-bc6544d06a58?w=800&h=600&fit=crop",
    alt: "Haedong Yonggungsa Temple",
    caption: "Temple by the sea"
  },
  {
    src: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&h=600&fit=crop",
    alt: "Gamcheon Culture Village",
    caption: "Colorful village"
  },
  {
    src: "https://images.unsplash.com/photo-1538485399081-7191377e8241?w=800&h=600&fit=crop",
    alt: "Haeundae Beach",
    caption: "Scenic coastline"
  },
  {
    src: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
    alt: "Traditional Korean street",
    caption: "Local atmosphere"
  },
  {
    src: "https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=800&h=600&fit=crop",
    alt: "Jagalchi Fish Market",
    caption: "Fresh seafood market"
  },
]

export function GallerySection() {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  const openLightbox = (index: number) => {
    setCurrentIndex(index)
    setLightboxOpen(true)
  }

  const closeLightbox = () => setLightboxOpen(false)
  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % galleryImages.length)
  const prevImage = () => setCurrentIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length)

  return (
    <>
      {/* Subtle blue-tinted background section */}
      <section className="relative py-12 md:py-16 overflow-hidden">
        {/* Soft gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/50 via-muted/30 to-white" />
        
        <div className="relative px-5 md:px-8 lg:px-0">
          <div className="max-w-4xl mx-auto lg:mx-0">
            {/* Section Header */}
            <div className="flex items-center gap-2 mb-3">
              <Images className="w-4 h-4 text-accent" />
              <span className="text-[11px] font-semibold tracking-widest uppercase text-accent">Gallery</span>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-foreground tracking-tight mb-8">
              Moments from the journey
            </h2>

            {/* Mobile: Editorial horizontal scroll with glass overlay */}
            <div className="md:hidden flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-2 snap-x snap-mandatory">
              {galleryImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => openLightbox(index)}
                  className="flex-shrink-0 snap-start relative overflow-hidden rounded-2xl group shadow-lg"
                >
                  <div className="w-52 aspect-[4/5] relative">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="object-cover transition-transform duration-700 group-active:scale-105"
                    />
                    {/* Premium gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/5" />
                  </div>
                  {/* Glass caption */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent">
                    <span className="text-xs text-white font-medium">
                      {image.caption}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop: Premium masonry grid with glass cards */}
            <div className="hidden md:grid grid-cols-12 gap-4">
              {/* Large featured image */}
              <button
                onClick={() => openLightbox(0)}
                className="col-span-8 row-span-2 relative overflow-hidden rounded-2xl group shadow-xl"
              >
                <div className="aspect-[4/3] relative">
                  <Image
                    src={galleryImages[0].src}
                    alt={galleryImages[0].alt}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-sm text-white font-medium">
                    {galleryImages[0].caption}
                  </span>
                </div>
              </button>

              {/* Right column images */}
              {galleryImages.slice(1, 3).map((image, index) => (
                <button
                  key={index + 1}
                  onClick={() => openLightbox(index + 1)}
                  className="col-span-4 relative overflow-hidden rounded-2xl group shadow-lg"
                >
                  <div className="aspect-square relative">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-xs text-white font-medium">
                      {image.caption}
                    </span>
                  </div>
                </button>
              ))}

              {/* Bottom row */}
              {galleryImages.slice(3).map((image, index) => (
                <button
                  key={index + 3}
                  onClick={() => openLightbox(index + 3)}
                  className="col-span-4 relative overflow-hidden rounded-2xl group shadow-lg"
                >
                  <div className="aspect-[4/3] relative">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="text-xs text-white font-medium">
                      {image.caption}
                    </span>
                  </div>
                </button>
              ))}
              
              {/* View all card - Glass effect */}
              <button
                onClick={() => openLightbox(0)}
                className="col-span-4 aspect-[4/3] relative overflow-hidden rounded-2xl glass-card flex flex-col items-center justify-center group hover:scale-[1.02] transition-all"
              >
                <Images className="w-7 h-7 text-accent mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                  View all {galleryImages.length}+
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox with glass controls */}
      {lightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div 
            className="relative w-full max-w-4xl aspect-[4/3] mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={galleryImages[currentIndex].src}
              alt={galleryImages[currentIndex].alt}
              fill
              className="object-contain"
            />
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
            <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
              <span className="text-white text-sm font-medium">{galleryImages[currentIndex].caption}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md">
              {galleryImages.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(index); }}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    index === currentIndex ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
