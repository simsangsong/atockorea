'use client';

import { useState } from 'react';
import { MapIcon, ClockIcon, CalendarDateIcon } from '@/components/Icons';

interface TourTabsProps {
  tour: {
    overview: string;
    itinerary: Array<{ time: string; title: string; description: string }>;
    inclusions: Array<{ icon: string; text: string }>;
    exclusions: Array<{ icon: string; text: string }>;
    pickupPoints: Array<{ id: number; name: string; address: string; lat: number; lng: number }>;
    reviews: Array<{
      id: number;
      author: string;
      rating: number;
      date: string;
      text: string;
      photos: string[];
    }>;
  };
}

type TabType = 'overview' | 'itinerary' | 'inclusions' | 'pickup' | 'reviews';

export default function TourTabs({ tour }: TourTabsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [reviewSort, setReviewSort] = useState<'latest' | 'highest' | 'longest'>('latest');

  const tabs = [
    { id: 'overview' as TabType, label: 'Overview' },
    { id: 'itinerary' as TabType, label: 'Itinerary' },
    { id: 'inclusions' as TabType, label: 'Inclusions/Exclusions' },
    { id: 'pickup' as TabType, label: 'Pickup Points' },
    { id: 'reviews' as TabType, label: 'Reviews' },
  ];

  // Sort reviews
  const sortedReviews = [...tour.reviews].sort((a, b) => {
    if (reviewSort === 'latest') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    } else if (reviewSort === 'highest') {
      return b.rating - a.rating;
    } else {
      return b.text.length - a.text.length;
    }
  });

  // Prioritize reviews with photos
  const reviewsWithPhotos = sortedReviews.filter((r) => r.photos.length > 0);
  const reviewsWithoutPhotos = sortedReviews.filter((r) => r.photos.length === 0);
  const displayReviews = [...reviewsWithPhotos, ...reviewsWithoutPhotos];

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Overview */}
        {activeTab === 'overview' && (
          <div>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{tour.overview}</p>
          </div>
        )}

        {/* Itinerary */}
        {activeTab === 'itinerary' && (
          <div className="relative">
            {/* Timeline */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-indigo-200"></div>
            
            <div className="space-y-6">
              {tour.itinerary.map((item, index) => (
                <div key={index} className="relative flex gap-6">
                  {/* Timeline Dot */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 border-4 border-white shadow-lg flex items-center justify-center z-10">
                    <ClockIcon className="w-4 h-4 text-white" />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-indigo-600">{item.time}</span>
                      <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                    </div>
                    <p className="text-gray-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inclusions/Exclusions */}
        {activeTab === 'inclusions' && (
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Inclusions</h3>
              <ul className="space-y-3">
                {tour.inclusions.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-green-600 font-bold text-lg">{item.icon}</span>
                    <span className="text-gray-700">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Exclusions</h3>
              <ul className="space-y-3">
                {tour.exclusions.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-red-600 font-bold text-lg">{item.icon}</span>
                    <span className="text-gray-700">{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Pickup Points */}
        {activeTab === 'pickup' && (
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Pickup Points</h3>
            <div className="space-y-4">
              {tour.pickupPoints.map((point) => (
                <div
                  key={point.id}
                  className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <MapIcon className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{point.name}</h4>
                      <p className="text-sm text-gray-600">{point.address}</p>
                    </div>
                    <a
                      href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                    >
                      View Map
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {activeTab === 'reviews' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Reviews</h3>
              <select
                value={reviewSort}
                onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm"
              >
                <option value="latest">Latest</option>
                <option value="highest">Highest Rating</option>
                <option value="longest">Longest Review</option>
              </select>
            </div>

            <div className="space-y-6">
              {displayReviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-6 last:border-0">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">{review.author}</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 fill-gray-300'
                              }`}
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-sm text-gray-500">{review.date}</span>
                      </div>
                    </div>
                    {review.photos.length > 0 && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                        With Photos
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700 mb-3">{review.text}</p>
                  {review.photos.length > 0 && (
                    <div className="flex gap-2">
                      {review.photos.map((photo, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                          <img
                            src={photo}
                            alt={`Review photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

