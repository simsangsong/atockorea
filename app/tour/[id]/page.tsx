'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import ImageGallery from '@/components/tour/ImageGallery';
import BookingSidebar from '@/components/tour/BookingSidebar';
import TourTabs from '@/components/tour/TourTabs';
import { HeartSolidIcon, HeartIcon } from '@/components/Icons';

// Sample tour data (in production, fetch from API)
const tourData = {
  id: 1,
  title: 'Gamcheon Culture Village + Haeundae',
  location: 'Busan',
  rating: 4.8,
  reviewCount: 234,
  badges: ['Popular', 'Small-group'],
  price: 79,
  priceType: 'person',
  images: [
    'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1200&q=80',
    'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1200&q=80',
    'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80',
    'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=1200&q=80',
    'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80',
  ],
  description: 'Explore the vibrant Gamcheon Culture Village, known as the "Machu Picchu of Busan", followed by a visit to the famous Haeundae Beach. This full-day tour combines art, culture, and coastal beauty.',
  overview: `Experience the colorful Gamcheon Culture Village, a hillside community transformed into a vibrant art district. Wander through narrow alleys adorned with murals, sculptures, and art installations. Then, relax at Haeundae Beach, one of Korea's most famous beaches, known for its fine sand and clear waters.

This tour offers a perfect blend of cultural immersion and coastal relaxation, making it ideal for first-time visitors to Busan.`,
  itinerary: [
    { time: '09:00', title: 'Hotel Pickup', description: 'Pickup from your hotel in Busan' },
    { time: '09:30', title: 'Gamcheon Culture Village', description: 'Explore the colorful village, visit art galleries and cafes' },
    { time: '12:00', title: 'Lunch Break', description: 'Enjoy local Korean cuisine' },
    { time: '13:30', title: 'Haeundae Beach', description: 'Relax at the beach, enjoy water activities' },
    { time: '16:00', title: 'Dongbaek Island', description: 'Scenic walk along the coastal path' },
    { time: '17:30', title: 'Return to Hotel', description: 'Drop-off at your hotel' },
  ],
  inclusions: [
    { icon: '✓', text: 'Hotel pickup and drop-off' },
    { icon: '✓', text: 'Professional English-speaking guide' },
    { icon: '✓', text: 'Entrance fees to all attractions' },
    { icon: '✓', text: 'Lunch included' },
    { icon: '✓', text: 'Transportation in air-conditioned vehicle' },
  ],
  exclusions: [
    { icon: '✗', text: 'Personal expenses' },
    { icon: '✗', text: 'Optional activities' },
    { icon: '✗', text: 'Tips for guide and driver' },
  ],
  pickupPoints: [
    { id: 1, name: 'Busan Station', address: 'Busan Station, Busan', lat: 35.1156, lng: 129.0422 },
    { id: 2, name: 'Haeundae Station', address: 'Haeundae Station, Busan', lat: 35.1631, lng: 129.1636 },
    { id: 3, name: 'Seomyeon Station', address: 'Seomyeon Station, Busan', lat: 35.1581, lng: 129.0594 },
    { id: 4, name: 'Gwangalli Beach', address: 'Gwangalli Beach, Busan', lat: 35.1532, lng: 129.1186 },
  ],
  reviews: [
    {
      id: 1,
      author: 'Sarah Johnson',
      rating: 5,
      date: '2025-01-15',
      text: 'Amazing tour! The guide was very knowledgeable and the village was absolutely beautiful. Highly recommend!',
      photos: ['https://images.unsplash.com/photo-1534008897995-27a23e859048?w=400&q=80'],
    },
    {
      id: 2,
      author: 'Michael Chen',
      rating: 4,
      date: '2025-01-10',
      text: 'Great experience overall. The beach visit was relaxing and the village tour was interesting.',
      photos: [],
    },
    {
      id: 3,
      author: 'Emma Wilson',
      rating: 5,
      date: '2025-01-08',
      text: 'Perfect day trip! The itinerary was well-planned and we saw so much. The lunch was delicious too.',
      photos: [
        'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=400&q=80',
        'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=400&q=80',
      ],
    },
  ],
};

export default function TourDetailPage() {
  const params = useParams();
  const tourId = params?.id;
  const [isFavorite, setIsFavorite] = useState(false);

  // In production, fetch tour data based on tourId
  const tour = tourData;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main>
        {/* Image Gallery */}
        <ImageGallery images={tour.images} />

        {/* Main Content */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Content */}
            <div className="flex-1">
              {/* Title and Rating */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 mb-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {tour.badges.map((badge, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-full"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                      {tour.title}
                    </h1>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-lg font-semibold text-gray-700 ml-1">{tour.rating}</span>
                        </div>
                        <span className="text-gray-500">({tour.reviewCount} reviews)</span>
                      </div>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">{tour.location}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFavorite(!isFavorite)}
                      className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      {isFavorite ? (
                        <HeartSolidIcon className="w-6 h-6 text-red-500" />
                      ) : (
                        <HeartIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </button>
                    <button className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Price */}
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-indigo-600">from ${tour.price}</span>
                    <span className="text-lg text-gray-500">/ {tour.priceType}</span>
                  </div>
                </div>
              </div>

              {/* Tabs Content */}
              <TourTabs tour={tour} />
            </div>

            {/* Right Sidebar - Booking */}
            <div className="lg:w-96 flex-shrink-0">
              <div className="lg:sticky lg:top-20">
                <BookingSidebar tour={tour} />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

