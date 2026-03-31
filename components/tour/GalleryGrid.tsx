'use client';

import { useState } from 'react';
import Image from 'next/image';

const INITIAL_VISIBLE = 3;

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
  const [showAll, setShowAll] = useState(false);

  const safeImages = images && images.length > 0 ? images : [];

  const normalizedImages = safeImages.map((img, index) => {
    if (typeof img === 'string') {
      return { url: img, title: `Attraction ${index + 1}`, description: '' };
    }
    return {
      url: img.url,
      title: img.title || `Attraction ${index + 1}`,
      description: img.description || '',
    };
  });

  if (safeImages.length === 0) return null;

  const hasMore = normalizedImages.length > INITIAL_VISIBLE;
  const visibleImages = showAll ? normalizedImages : normalizedImages.slice(0, INITIAL_VISIBLE);

  return (
    <>
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Photos</h2>
        <div className="flex gap-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 flex-1 min-w-0">
            {visibleImages.map((image, index) => (
              <div key={index}>
                <button
                  onClick={() => setSelectedImage(showAll ? index : index)}
                  className="relative w-full aspect-[4/3] rounded-xl overflow-hidden group cursor-pointer bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-1"
                >
                  <Image
                    src={image.url}
                    alt={image.title || `Gallery image ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                </button>
              </div>
            ))}
          </div>
          {hasMore && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="flex-shrink-0 flex flex-col items-center justify-center min-w-[56px] w-14 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition-colors text-gray-600"
              aria-label="더 보기"
            >
              <span className="text-xl font-bold tracking-tighter rotate-90 origin-center">»</span>
              <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">More</span>
            </button>
          )}
        </div>
        {hasMore && showAll && (
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700"
          >
            접기
          </button>
        )}
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

