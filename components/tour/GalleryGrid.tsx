'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ImageWithDescription {
  url: string;
  description?: string;
  title?: string;
}

interface GalleryGridProps {
  images: string[] | ImageWithDescription[];
}

export default function GalleryGrid({ images }: GalleryGridProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  // Ensure images array is not empty
  const safeImages = images && images.length > 0 ? images : [];

  // Normalize images to have consistent structure
  const normalizedImages = safeImages.map((img, index) => {
    if (typeof img === 'string') {
      return {
        url: img,
        title: `Attraction ${index + 1}`,
        description: '',
      };
    }
    return {
      url: img.url,
      title: img.title || `Attraction ${index + 1}`,
      description: img.description || '',
    };
  });

  if (safeImages.length === 0) {
    return null;
  }

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-4 md:p-6 fade-in-delay-1">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 md:mb-5">Photo Gallery</h2>
        <div className="space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
          {normalizedImages.map((image, index) => (
            <div key={index} className="space-y-2.5 md:space-y-2">
              {/* Text Area Above Image */}
              {(image.title || image.description) && (
                <div className="space-y-1">
                  {image.title && (
                    <h3 className="text-sm md:text-xs font-medium text-gray-900">{image.title}</h3>
                  )}
                  {image.description && (
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{image.description}</p>
                  )}
                </div>
              )}
              
              {/* Image - Smaller on desktop, refined aspect ratio */}
              <button
                onClick={() => setSelectedImage(index)}
                className="relative w-full aspect-video md:aspect-[4/3] rounded-lg overflow-hidden group cursor-pointer shadow-sm hover:shadow-md transition-all duration-300"
              >
                <Image
                  src={image.url}
                  alt={image.title || `Gallery image ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
            className="absolute top-4 right-4 z-[101] p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors cursor-pointer"
            aria-label="Close"
            type="button"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {selectedImage !== null && normalizedImages[selectedImage] && (
              <Image
                src={normalizedImages[selectedImage].url}
                alt={normalizedImages[selectedImage].title || `Gallery image ${selectedImage + 1}`}
                fill
                className="object-contain"
                sizes="100vw"
              />
            )}
            {normalizedImages.length > 1 && selectedImage !== null && (
              <>
                <button
                  onClick={() => setSelectedImage((selectedImage - 1 + normalizedImages.length) % normalizedImages.length)}
                  className="absolute left-4 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setSelectedImage((selectedImage + 1) % normalizedImages.length)}
                  className="absolute right-4 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

