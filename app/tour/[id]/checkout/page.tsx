'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations } from '@/lib/i18n';

interface BookingData {
  tourId: number;
  date: string;
  guests: number;
  pickup: number | null;
  paymentMethod: 'deposit' | 'full';
  depositAmountKRW?: number;
  balanceAmountKRW?: number;
  totalPrice: number;
  promoCode?: string;
}

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  preferredChatApp: string;
  chatAppContact: string;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations();
  const [bookingData, setBookingData] = useState<BookingData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: '',
    preferredChatApp: '',
    chatAppContact: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});

  useEffect(() => {
    // Get booking data from sessionStorage
    const stored = sessionStorage.getItem('bookingData');
    if (stored) {
      setBookingData(JSON.parse(stored));
    } else {
      // If no booking data, redirect back
      router.push(`/tour/${params.id}`);
    }
  }, [params.id, router]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};
    
    if (!customerInfo.name.trim()) {
      newErrors.name = t('errors.pleaseEnter') + ' ' + t('booking.fullName').toLowerCase();
    }
    if (!customerInfo.phone.trim()) {
      newErrors.phone = t('errors.pleaseEnter') + ' ' + t('booking.phone').toLowerCase();
    }
    if (!customerInfo.email.trim()) {
      newErrors.email = t('errors.pleaseEnter') + ' ' + t('booking.email').toLowerCase();
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
      newErrors.email = t('errors.invalidEmail');
    }
    if (!customerInfo.preferredChatApp.trim()) {
      newErrors.preferredChatApp = t('errors.pleaseSelect') + ' ' + t('tour.preferredChatApp').toLowerCase();
    }
    if (!customerInfo.chatAppContact.trim()) {
      newErrors.chatAppContact = t('errors.pleaseEnter') + ' ' + t('tour.chatAppContact').toLowerCase();
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePayment = async () => {
    if (!bookingData) return;
    
    if (!validateForm()) {
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Determine payment amount: deposit if deposit method selected, otherwise full price
      const paymentAmount = bookingData.paymentMethod === 'deposit' 
        ? (bookingData.depositAmountKRW || 10000) 
        : bookingData.totalPrice;
      
      // Create booking in database
      const bookingPayload = {
        tourId: bookingData.tourId.toString(),
        bookingDate: bookingData.date,
        numberOfGuests: bookingData.guests,
        pickupPointId: bookingData.pickup ? bookingData.pickup.toString() : null,
        finalPrice: bookingData.totalPrice, // Keep total price for booking record
        paymentMethod: bookingData.paymentMethod === 'deposit' ? 'deposit' : 'full',
        specialRequests: JSON.stringify({
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        }),
        customerInfo: {
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        },
      };

      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!bookingResponse.ok) {
        const errorData = await bookingResponse.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      const bookingResult = await bookingResponse.json();
      
      // Save booking ID and customer info to sessionStorage for confirmation page
      const completeBookingData = {
        ...bookingData,
        bookingId: bookingResult.booking.id,
        customerInfo,
      };
      sessionStorage.setItem('bookingData', JSON.stringify(completeBookingData));
      
      // Redirect to Stripe checkout for both deposit and full payment
      try {
        const paymentResponse = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: paymentAmount,
            currency: 'usd',
            bookingId: bookingResult.booking.id,
            bookingData: completeBookingData,
          }),
        });
        
        const paymentData = await paymentResponse.json();
        
        if (paymentData.url) {
          // Redirect to Stripe checkout
          window.location.href = paymentData.url;
          return;
        } else {
          // If Stripe is not implemented, proceed to confirmation
          console.warn('Stripe checkout not available, proceeding to confirmation');
          router.push(`/tour/${params.id}/confirmation`);
          return;
        }
      } catch (error) {
        console.error('Payment error:', error);
        // Even if payment fails, booking is created, so proceed to confirmation
        router.push(`/tour/${params.id}/confirmation`);
        return;
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      alert(error.message || 'Failed to process booking. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!bookingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-2xl mx-auto">
            <p className="text-center text-gray-600">Loading booking information...</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-orange-50/30">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Complete Your Booking</h1>
            <p className="text-gray-600">Please fill in your information to complete the reservation</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Customer Information Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Customer Information Form */}
              <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-6 md:p-8 transition-all hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Customer Information</h2>
                    <p className="text-sm text-gray-500">Required fields <span className="text-red-500">*</span></p>
                  </div>
                </div>
                <div className="space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      {t('booking.fullName')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerInfo.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white ${
                        errors.name ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                      }`}
                      placeholder={t('booking.enterFullName')}
                    />
                    {errors.name && <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.name}
                    </p>}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      {t('booking.phone')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white ${
                        errors.phone ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                      }`}
                      placeholder={t('booking.enterPhone')}
                    />
                    {errors.phone && <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.phone}
                    </p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      {t('booking.email')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={customerInfo.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white ${
                        errors.email ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                      }`}
                      placeholder={t('booking.enterEmail')}
                    />
                    {errors.email && <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.email}
                    </p>}
                  </div>

                  {/* Preferred Chat App */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      {t('tour.preferredChatApp')} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customerInfo.preferredChatApp}
                      onChange={(e) => handleInputChange('preferredChatApp', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white appearance-none ${
                        errors.preferredChatApp ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                      }`}
                    >
                      <option value="">{t('tour.pleaseSelect')}</option>
                      <option value="kakao">KakaoTalk</option>
                      <option value="line">LINE</option>
                      <option value="wechat">WeChat</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telegram">Telegram</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.preferredChatApp && <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.preferredChatApp}
                    </p>}
                  </div>

                  {/* Chat App Contact */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      {t('tour.chatAppContact')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerInfo.chatAppContact}
                      onChange={(e) => handleInputChange('chatAppContact', e.target.value)}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all bg-gray-50/50 focus:bg-white ${
                        errors.chatAppContact ? 'border-red-400 bg-red-50/50' : 'border-gray-200'
                      }`}
                      placeholder={t('tour.enterChatAppId')}
                    />
                    {errors.chatAppContact && <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.chatAppContact}
                    </p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Booking Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                {/* Booking Summary */}
                <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] border border-gray-200/60 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{t('booking.bookingSummary')}</h2>
                  </div>
                  <div className="space-y-4 pb-4 border-b border-gray-200">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {t('booking.tourDate')}
                      </span>
                      <span className="text-sm font-semibold text-gray-900 text-right">
                        {new Date(bookingData.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        {t('tour.guests')}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{bookingData.guests}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        {t('booking.paymentMethod')}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {bookingData.paymentMethod === 'deposit' ? t('booking.depositCash') : t('booking.fullPayment')}
                      </span>
                    </div>
                  </div>

                  {/* Payment Details */}
                  {bookingData.paymentMethod === 'deposit' && bookingData.depositAmountKRW && bookingData.balanceAmountKRW && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{t('booking.deposit')}</span>
                          <span className="text-sm font-bold text-blue-600">₩{bookingData.depositAmountKRW.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{t('booking.payOnSite')}</span>
                          <span className="text-sm font-bold text-gray-900">₩{bookingData.balanceAmountKRW.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Total */}
                  <div className="mt-5 pt-5 border-t-2 border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-bold text-gray-900">{t('tour.total')}</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                        {bookingData.paymentMethod === 'deposit' 
                          ? `₩${(bookingData.depositAmountKRW || 10000).toLocaleString()}`
                          : `₩${bookingData.totalPrice.toLocaleString()}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Button */}
                <button
                  onClick={handlePayment}
                  disabled={isProcessing || !customerInfo.name || !customerInfo.phone || !customerInfo.email || !customerInfo.preferredChatApp || !customerInfo.chatAppContact}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_20px_rgba(37,99,235,0.5)] text-lg transform hover:-translate-y-0.5 disabled:transform-none"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('booking.processing')}
                    </span>
                  ) : bookingData.paymentMethod === 'deposit' ? t('booking.payDeposit') : t('booking.completeBooking')}
                </button>
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

