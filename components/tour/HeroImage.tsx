'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface ImageWithDescription {
  url: string;
  description?: string;
  title?: string;
}

interface HeroImageProps {
  images: string[] | ImageWithDescription[];
  title?: string;
  tagline?: string;
}

export default function HeroImage({ images, title, tagline }: HeroImageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Normalize images to extract URLs
  const normalizeImages = (imgs: string[] | ImageWithDescription[]) => {
    if (!imgs || imgs.length === 0) {
      return ['https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1200&q=80'];
    }
    return imgs.map((img) => (typeof img === 'string' ? img : img.url));
  };

  const safeImages = normalizeImages(images);

  // Auto-advance carousel
  useEffect(() => {
    if (safeImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % safeImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [safeImages.length]);

  return (
    <div className="relative w-full aspect-video md:aspect-[4/1] overflow-hidden">
      {/* Image Carousel */}
      <div className="relative w-full h-full">
        {safeImages.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <Image
              src={image}
              alt={`${title} - Image ${index + 1}`}
              fill
              className="object-cover"
              priority={index === 0}
              onLoad={() => setIsLoaded(true)}
              sizes="100vw"
            />
            {/* Parallax overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
          </div>
        ))}
      </div>

      {/* Dots Indicator - Very small on mobile, original size on desktop */}
      {safeImages.length > 1 && (
        <div className="absolute bottom-2 md:bottom-6 left-1/2 transform -translate-x-1/2 flex gap-1 md:gap-1.5">
          {safeImages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`rounded-full transition-all scale-50 md:scale-100 ${
                index === currentIndex
                  ? 'w-[1px] h-[1px] md:w-8 md:h-2.5'
                  : 'w-[1px] h-[1px] md:w-2.5 md:h-2.5'
              } ${
                index === currentIndex
                  ? 'bg-white/30 md:bg-white'
                  : 'bg-white/20 md:bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Navigation Arrows */}
      {safeImages.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((currentIndex - 1 + safeImages.length) % safeImages.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
            aria-label="Previous image"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setCurrentIndex((currentIndex + 1) % safeImages.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
            aria-label="Next image"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

