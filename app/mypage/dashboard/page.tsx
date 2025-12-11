'use client';

import Link from 'next/link';
import { CheckIcon, CalendarIcon, HistoryIcon, StarIcon } from '@/components/Icons';

export default function DashboardPage() {
  const upcomingTours = 3;
  const totalBookings = 12;
  const reviews = 8;

  const handleNavigation = (e: React.MouseEvent, path: string) => {
    // On mobile, force full page navigation
    if (window.innerWidth < 768) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = path;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 md:p-10 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-3 tracking-tight">Welcome back, John!</h1>
        <p className="text-[15px] text-gray-600 font-medium">Here's what's happening with your bookings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/mypage/upcoming"
          onClick={(e) => handleNavigation(e, '/mypage/upcoming')}
          className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium text-gray-600 tracking-wide">Upcoming Tours</span>
            <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)] group-hover:scale-110 transition-transform duration-300">
              <div className="w-4 h-4">
                <CalendarIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">{upcomingTours}</p>
        </Link>
        <Link
          href="/mypage/mybookings"
          onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
          className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium text-gray-600 tracking-wide">Total Bookings</span>
            <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] group-hover:scale-110 transition-transform duration-300">
              <div className="w-4 h-4">
                <HistoryIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">{totalBookings}</p>
        </Link>
        <Link
          href="/mypage/reviews"
          onClick={(e) => handleNavigation(e, '/mypage/reviews')}
          className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-7 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300 cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-base font-medium text-gray-600 tracking-wide">Reviews</span>
            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] group-hover:scale-110 transition-transform duration-300">
              <div className="w-4 h-4">
                <StarIcon className="w-4 h-4" />
              </div>
            </div>
          </div>
          <p className="text-4xl font-bold text-gray-900 tracking-tight">{reviews}</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Recent Activity</h2>
          <Link
            href="/mypage/mybookings"
            onClick={(e) => handleNavigation(e, '/mypage/mybookings')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium tracking-wide transition-colors"
          >
            View All →
          </Link>
        </div>
        <div className="space-y-3">
          {[
            { action: 'Booked', tour: 'Seoul City Tour', date: '2 days ago', tourId: 1 },
            { action: 'Reviewed', tour: 'Jeju Island Adventure', date: '5 days ago', tourId: 2 },
            { action: 'Cancelled', tour: 'Busan Beach Tour', date: '1 week ago', tourId: 3 },
          ].map((activity, idx) => (
            <Link
              key={idx}
              href={`/tour/${activity.tourId}`}
              onClick={(e) => {
                if (window.innerWidth < 768) {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/tour/${activity.tourId}`;
                }
              }}
              className="flex items-center gap-4 p-5 bg-gradient-to-r from-gray-50/80 to-gray-50/40 rounded-xl hover:from-gray-100/80 hover:to-gray-100/40 transition-all duration-200 cursor-pointer border border-gray-200/40 hover:border-gray-300/60 hover:shadow-sm"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white shadow-[0_4px_12px_rgba(59,130,246,0.25)]">
                <div className="w-4 h-4">
                  <CheckIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-base mb-1">
                  {activity.action} {activity.tour}
                </p>
                <p className="text-sm text-gray-500 font-medium">{activity.date}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

