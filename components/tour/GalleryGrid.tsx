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
      <div className="rounded-xl bg-white border-2 border-gray-200 shadow-md p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Photo Gallery</h2>
        <div className="space-y-4">
          {normalizedImages.map((image, index) => (
            <div key={index} className="w-full">
              <button
                onClick={() => setSelectedImage(index)}
                className="relative w-full aspect-video lg:max-h-[225px] rounded-lg overflow-hidden group cursor-pointer border-2 border-gray-200 hover:border-blue-500 transition-all duration-300 shadow-sm hover:shadow-lg"
              >
                <Image
                  src={image.url}
                  alt={image.title || `Gallery image ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              {(image.title || image.description) && (
                <div className="mt-2 px-1">
                  {image.title && (
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{image.title}</h3>
                  )}
                  {image.description && (
                    <p className="text-xs text-gray-600 leading-relaxed">{image.description}</p>
                  )}
                </div>
              )}
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

