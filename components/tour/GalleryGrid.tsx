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
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Photos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {normalizedImages.map((image, index) => (
            <div key={index}>
              <button
                onClick={() => setSelectedImage(index)}
                className="relative w-full aspect-[4/3] rounded-xl overflow-hidden group cursor-pointer bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
              >
                <Image
                  src={image.url}
                  alt={image.title || `Gallery image ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                  sizes="(max-width: 640px) 50vw, 33vw"
                />
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

