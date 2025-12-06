'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { HeartSolidIcon } from '@/components/Icons';

interface WishlistItem {
  id: number;
  title: string;
  price: number;
  image: string;
  tourId: number;
}

export default function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([
    {
      id: 1,
      title: 'Seoul City Tour',
      price: 89,
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
      tourId: 1,
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      price: 149,
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
      tourId: 2,
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      price: 79,
      image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=400',
      tourId: 3,
    },
    {
      id: 4,
      title: 'DMZ Tour',
      price: 99,
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
      tourId: 4,
    },
  ]);

  const handleRemove = (id: number) => {
    if (confirm('Remove this tour from your wishlist?')) {
      setWishlistItems(wishlistItems.filter((item) => item.id !== id));
      alert('Removed from wishlist');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Wishlist</h1>
        <p className="text-gray-600">Your saved tours</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {wishlistItems.length > 0 ? (
          wishlistItems.map((item) => (
            <div
              key={item.id}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow"
            >
              <div className="h-48 relative">
                <Image src={item.image} alt={item.title} fill className="object-cover" />
                <button
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors"
                >
                  <HeartSolidIcon className="w-5 h-5 text-red-500" />
                </button>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-indigo-600">${item.price}</span>
                  <Link
                    href={`/tour/${item.tourId}`}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    Book Now
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
            <p className="text-gray-500">Your wishlist is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

