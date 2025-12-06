'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

type MenuItem = 'dashboard' | 'upcoming' | 'history' | 'reviews' | 'wishlist' | 'settings';

export default function MyPage() {
  const [activeMenu, setActiveMenu] = useState<MenuItem>('dashboard');

  const menuItems = [
    { id: 'dashboard' as MenuItem, label: 'Dashboard', icon: '📊' },
    { id: 'upcoming' as MenuItem, label: 'Upcoming Tours', icon: '📅' },
    { id: 'history' as MenuItem, label: 'Booking History', icon: '📜' },
    { id: 'reviews' as MenuItem, label: 'Reviews', icon: '⭐' },
    { id: 'wishlist' as MenuItem, label: 'Wishlist', icon: '❤️' },
    { id: 'settings' as MenuItem, label: 'Account Settings', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 sticky top-20">
              {/* User Profile */}
              <div className="flex flex-col items-center mb-6 pb-6 border-b border-gray-200">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg">
                  JD
                </div>
                <h2 className="text-lg font-bold text-gray-900">John Doe</h2>
                <p className="text-sm text-gray-500">john.doe@example.com</p>
              </div>

              {/* Navigation Menu */}
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveMenu(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      activeMenu === item.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-all mt-4">
                  <span className="text-lg">🚪</span>
                  <span>Logout</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {activeMenu === 'dashboard' && <DashboardView />}
            {activeMenu === 'upcoming' && <UpcomingToursView />}
            {activeMenu === 'history' && <BookingHistoryView />}
            {activeMenu === 'reviews' && <ReviewsView />}
            {activeMenu === 'wishlist' && <WishlistView />}
            {activeMenu === 'settings' && <AccountSettingsView />}
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

// Dashboard Component
function DashboardView() {
  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome back, John! 👋</h1>
        <p className="text-gray-600">Here's what's happening with your bookings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Upcoming Tours</span>
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-3xl font-bold text-indigo-600">3</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total Bookings</span>
            <span className="text-2xl">📜</span>
          </div>
          <p className="text-3xl font-bold text-indigo-600">12</p>
        </div>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Reviews</span>
            <span className="text-2xl">⭐</span>
          </div>
          <p className="text-3xl font-bold text-indigo-600">8</p>
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
                <span className="text-indigo-600">✓</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{activity.action} {activity.tour}</p>
                <p className="text-sm text-gray-500">{activity.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Upcoming Tours Component
function UpcomingToursView() {
  const tours = [
    {
      id: 1,
      title: 'Seoul City Tour',
      date: '2025-02-15',
      time: '09:00 AM',
      status: 'Confirmed',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      date: '2025-02-20',
      time: '08:00 AM',
      status: 'Pending',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      date: '2025-02-25',
      time: '10:00 AM',
      status: 'Confirmed',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Upcoming Tours</h1>
        <p className="text-gray-600">Manage your upcoming bookings</p>
      </div>

      <div className="space-y-4">
        {tours.map((tour) => (
          <div
            key={tour.id}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden"
          >
            <div className="flex flex-col md:flex-row">
              <div className="md:w-48 h-48 md:h-auto flex-shrink-0">
                <img
                  src={tour.image}
                  alt={tour.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{tour.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>📅 {tour.date}</span>
                      <span>🕐 {tour.time}</span>
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
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                    View Details
                  </button>
                  <button className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium">
                    Cancel Booking
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Booking History Component
function BookingHistoryView() {
  const bookings = [
    {
      id: 1,
      title: 'Seoul City Tour',
      date: '2025-01-10',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      date: '2024-12-20',
      status: 'Completed',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      date: '2024-11-15',
      status: 'Cancelled',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking History</h1>
        <p className="text-gray-600">View your past bookings</p>
      </div>

      <div className="relative">
        {/* Timeline */}
        <div className="absolute left-4 md:left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        
        <div className="space-y-6">
          {bookings.map((booking, idx) => (
            <div key={booking.id} className="relative flex gap-6">
              {/* Timeline Dot */}
              <div className="flex-shrink-0 w-8 h-8 md:w-16 md:h-16 rounded-full bg-white border-4 border-indigo-600 flex items-center justify-center z-10">
                <span className="text-indigo-600 text-xs md:text-sm font-bold">{idx + 1}</span>
              </div>
              
              {/* Content */}
              <div className="flex-1 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden mb-6">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-48 h-48 md:h-auto flex-shrink-0">
                    <img
                      src={booking.image}
                      alt={booking.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">{booking.title}</h3>
                        <p className="text-sm text-gray-600">📅 {booking.date}</p>
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
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                      Rebook Tour
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Reviews Component
function ReviewsView() {
  const writtenReviews = [
    {
      id: 1,
      tour: 'Seoul City Tour',
      rating: 5,
      comment: 'Amazing experience! The guide was very knowledgeable.',
      date: '2025-01-12',
    },
    {
      id: 2,
      tour: 'Jeju Island Adventure',
      rating: 4,
      comment: 'Great tour, beautiful scenery.',
      date: '2024-12-22',
    },
  ];

  const canReview = [
    { id: 1, tour: 'Busan Beach Tour', date: '2025-01-05' },
    { id: 2, tour: 'DMZ Tour', date: '2024-12-10' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reviews</h1>
        <p className="text-gray-600">Share your travel experiences</p>
      </div>

      {/* Written Reviews */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Reviews</h2>
        <div className="space-y-4">
          {writtenReviews.map((review) => (
            <div key={review.id} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{review.tour}</h3>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                      ⭐
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-gray-600 mb-2">{review.comment}</p>
              <p className="text-sm text-gray-500">📅 {review.date}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Can Review */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Write a Review</h2>
        <div className="space-y-4">
          {canReview.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <h3 className="font-semibold text-gray-900">{item.tour}</h3>
                <p className="text-sm text-gray-500">📅 {item.date}</p>
              </div>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                Write Review
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Wishlist Component
function WishlistView() {
  const wishlistItems = [
    {
      id: 1,
      title: 'Seoul City Tour',
      price: '$89',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
    },
    {
      id: 2,
      title: 'Jeju Island Adventure',
      price: '$149',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
    },
    {
      id: 3,
      title: 'Busan Beach Tour',
      price: '$79',
      image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400',
    },
    {
      id: 4,
      title: 'DMZ Tour',
      price: '$99',
      image: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Wishlist</h1>
        <p className="text-gray-600">Your saved tours</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {wishlistItems.map((item) => (
          <div
            key={item.id}
            className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow"
          >
            <div className="h-48 relative">
              <img
                src={item.image}
                alt={item.title}
                className="w-full h-full object-cover"
              />
              <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50 transition-colors">
                <span className="text-red-500">❤️</span>
              </button>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-indigo-600">{item.price}</span>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                  Book Now
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Account Settings Component
function AccountSettingsView() {
  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Settings</h1>
        <p className="text-gray-600">Manage your account information</p>
      </div>

      {/* Personal Information */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Personal Information</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
            <input
              type="text"
              defaultValue="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              defaultValue="john.doe@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              type="tel"
              defaultValue="+82 10-1234-5678"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            Save Changes
          </button>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Change Password</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            Update Password
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Notification Preferences</h2>
        <div className="space-y-4">
          {[
            { label: 'Email Notifications', checked: true },
            { label: 'SMS Notifications', checked: false },
            { label: 'Push Notifications', checked: true },
            { label: 'Marketing Emails', checked: false },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{item.label}</label>
              <input
                type="checkbox"
                defaultChecked={item.checked}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
            </div>
          ))}
          <button className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

