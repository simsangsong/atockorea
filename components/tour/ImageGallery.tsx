'use client';

import { useState } from 'react';
import Image from 'next/image';
import { HeartSolidIcon, HeartIcon } from '@/components/Icons';

interface ImageGalleryProps {
  images: string[];
}

export default function ImageGallery({ images }: ImageGalleryProps) {
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  const mainImage = images[mainImageIndex];
  const thumbnails = images.slice(0, 4);

  return (
    <div className="relative w-full h-[400px] sm:h-[500px] md:h-[600px] bg-gray-200">
      {/* Main Image */}
      <div className="relative w-full h-full">
        <Image
          src={mainImage}
          alt="Tour image"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 flex gap-3 z-10">
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
          >
            {isFavorite ? (
              <HeartSolidIcon className="w-6 h-6 text-red-500" />
            ) : (
              <HeartIcon className="w-6 h-6 text-gray-700" />
            )}
          </button>
          <button className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Thumbnail Gallery */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="flex gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
          {thumbnails.map((image, index) => (
            <button
              key={index}
              onClick={() => setMainImageIndex(index)}
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all ${
                mainImageIndex === index
                  ? 'border-indigo-600 scale-105'
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <Image
                src={image}
                alt={`Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

