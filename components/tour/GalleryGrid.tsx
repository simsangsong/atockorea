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
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200/50 p-6 fade-in-delay-1">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Photo Gallery</h2>
        <div className="space-y-8">
          {normalizedImages.map((image, index) => (
            <div key={index} className="space-y-4">
              {/* Text Area Above Image */}
              {(image.title || image.description) && (
                <div className="space-y-2">
                  {image.title && (
                    <h3 className="text-lg font-semibold text-gray-900">{image.title}</h3>
                  )}
                  {image.description && (
                    <p className="text-sm text-gray-600 leading-relaxed">{image.description}</p>
                  )}
                </div>
              )}
              
              {/* Image - 16:9 Aspect Ratio */}
              <button
                onClick={() => setSelectedImage(index)}
                className="relative w-full aspect-video rounded-lg overflow-hidden group cursor-pointer shadow-md hover:shadow-xl transition-shadow"
              >
                <Image
                  src={image.url}
                  alt={image.title || `Gallery image ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 z-60 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors"
            aria-label="Close"
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

