'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CalendarDateIcon } from '@/components/Icons';

interface Booking {
  id: number;
  title: string;
  date: string;
  status: 'Completed' | 'Cancelled';
  image: string;
  tourId: number;
}

export default function BookingHistoryPage() {
  const bookings: Booking[] = [
    {
      id: 1,
      title: 'Seoul City Tour',
      date: '2025-01-10',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
      tourId: 1,
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      date: '2024-12-20',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
      tourId: 2,
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      date: '2024-11-15',
      status: 'Cancelled',
      image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=400',
      tourId: 3,
    },
  ];

  const handleRebook = (tourId: number) => {
    window.location.href = `/tour/${tourId}`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking History</h1>
        <p className="text-gray-600">View your past bookings</p>
      </div>

      <div className="relative">
        <div className="absolute left-4 md:left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>

        <div className="space-y-6">
          {bookings.length > 0 ? (
            bookings.map((booking, idx) => (
              <div key={booking.id} className="relative flex gap-6">
                <div className="flex-shrink-0 w-8 h-8 md:w-16 md:h-16 rounded-full bg-white border-4 border-indigo-600 flex items-center justify-center z-10">
                  <span className="text-indigo-600 text-xs md:text-sm font-bold">{idx + 1}</span>
                </div>

                <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden mb-6">
                  <div className="flex flex-col md:flex-row">
                    <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
                      <Image
                        src={booking.image}
                        alt={booking.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900 mb-2">{booking.title}</h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1.5">
                            <CalendarDateIcon className="w-4 h-4" />
                            {booking.date}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            booking.status === 'Completed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <Link
                          href={`/tour/${booking.tourId}`}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          View Details
                        </Link>
                        {booking.status === 'Completed' && (
                          <button
                            onClick={() => handleRebook(booking.tourId)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                          >
                            Rebook Tour
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
              <p className="text-gray-500">No booking history</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

