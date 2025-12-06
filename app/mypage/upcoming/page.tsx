'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon, ClockIcon } from '@/components/Icons';

interface UpcomingTour {
  id: number;
  title: string;
  date: string;
  time: string;
  status: 'Confirmed' | 'Pending';
  image: string;
  tourId: number;
}

export default function UpcomingToursPage() {
  const [tours, setTours] = useState<UpcomingTour[]>([
    {
      id: 1,
      title: 'Seoul City Tour',
      date: '2025-02-15',
      time: '09:00 AM',
      status: 'Confirmed',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
      tourId: 1,
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      date: '2025-02-20',
      time: '08:00 AM',
      status: 'Pending',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
      tourId: 2,
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      date: '2025-02-25',
      time: '10:00 AM',
      status: 'Confirmed',
      image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=400',
      tourId: 3,
    },
  ]);

  const handleCancel = (id: number) => {
    if (confirm('Are you sure you want to cancel this booking?')) {
      setTours(tours.filter((tour) => tour.id !== id));
      alert('Booking cancelled successfully');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upcoming Tours</h1>
        <p className="text-gray-600">Manage your upcoming bookings</p>
      </div>

      <div className="space-y-4">
        {tours.length > 0 ? (
          tours.map((tour) => (
            <div
              key={tour.id}
              className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden"
            >
              <div className="flex flex-col md:flex-row">
                <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
                  <Image
                    src={tour.image}
                    alt={tour.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{tour.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1.5">
                          <CalendarDateIcon className="w-4 h-4" />
                          {tour.date}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ClockIcon className="w-4 h-4" />
                          {tour.time}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        tour.status === 'Confirmed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {tour.status}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/tour/${tour.tourId}`}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => handleCancel(tour.id)}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                    >
                      Cancel Booking
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
            <p className="text-gray-500">No upcoming tours</p>
          </div>
        )}
      </div>
    </div>
  );
}

