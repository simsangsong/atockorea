'use client';

import { CheckIcon, CalendarIcon, HistoryIcon, StarIcon } from '@/components/Icons';

export default function DashboardPage() {
  const upcomingTours = 3;
  const totalBookings = 12;
  const reviews = 8;

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, John!</h1>
        <p className="text-gray-600">Here's what's happening with your bookings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Upcoming Tours</span>
            <CalendarIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-indigo-600">{upcomingTours}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Bookings</span>
            <HistoryIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-indigo-600">{totalBookings}</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Reviews</span>
            <StarIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-indigo-600">{reviews}</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {[
            { action: 'Booked', tour: 'Seoul City Tour', date: '2 days ago' },
            { action: 'Reviewed', tour: 'Jeju Island Adventure', date: '5 days ago' },
            { action: 'Cancelled', tour: 'Busan Beach Tour', date: '1 week ago' },
          ].map((activity, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <CheckIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {activity.action} {activity.tour}
                </p>
                <p className="text-sm text-gray-500">{activity.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

