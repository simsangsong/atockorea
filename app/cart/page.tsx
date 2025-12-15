'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { TrashIcon, HeartIcon, CalendarDateIcon, MapIcon, ClockIcon } from '@/components/Icons';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';

interface CartItem {
  id: string;
  tourId: string;
  title: string;
  location: string;
  date: string;
  time: string | null;
  quantity: number;
  price: number;
  originalPrice: number;
  priceType: 'person' | 'group';
  image: string;
  duration: string;
  pickupPoint?: string;
}

export default function CartPage() {
  const router = useRouter();
  const t = useTranslations();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [validatingPromo, setValidatingPromo] = useState(false);

  useEffect(() => {
    fetchCartItems();
  }, []);

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        setError(t('errors.unauthorized'));
        setLoading(false);
        return;
      }

      const response = await fetch('/api/cart', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/signin?redirect=/cart');
          return;
        }
        throw new Error(t('errors.somethingWentWrong'));
      }

      const data = await response.json();
      
      // Transform API data to match component expectations
      const transformedItems: CartItem[] = (data.cartItems || []).map((item: any) => {
        const tour = item.tours || {};
        const pickupPoint = item.pickup_points || {};
        
        return {
          id: item.id,
          tourId: item.tour_id,
          title: tour.title || 'Tour',
          location: tour.city || '',
          date: item.booking_date || item.tour_date || '',
          time: item.tour_time || null,
          quantity: item.number_of_guests || item.quantity || 1,
          price: parseFloat(item.unit_price?.toString() || tour.price?.toString() || '0'),
          originalPrice: parseFloat(tour.original_price?.toString() || item.unit_price?.toString() || '0'),
          priceType: tour.price_type || 'person',
          image: tour.image_url || (tour.images && tour.images[0]) || 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80',
          duration: tour.duration || '',
          pickupPoint: pickupPoint.name || pickupPoint.address || undefined,
        };
      });

      setCartItems(transformedItems);
    } catch (err: any) {
      console.error('Error fetching cart:', err);
      setError(err.message || t('errors.somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = async (id: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemove(id);
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert(t('errors.unauthorized'));
        return;
      }

      const response = await fetch(`/api/cart/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          numberOfGuests: newQuantity,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.somethingWentWrong'));
      }

      // Update local state
      setCartItems(cartItems.map((item) => 
        item.id === id ? { ...item, quantity: newQuantity } : item
      ));
    } catch (err: any) {
      console.error('Error updating quantity:', err);
      alert(`${t('errors.somethingWentWrong')}: ${err.message}`);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm(t('cart.remove') + '?')) {
      return;
    }

    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert(t('errors.unauthorized'));
        return;
      }

      const response = await fetch(`/api/cart/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.somethingWentWrong'));
      }

      // Remove from local state
      setCartItems(cartItems.filter((item) => item.id !== id));
    } catch (err: any) {
      console.error('Error removing item:', err);
      alert(`${t('errors.somethingWentWrong')}: ${err.message}`);
    }
  };

  const handleMoveToWishlist = async (item: CartItem) => {
    try {
      const { data: { session } } = await supabase?.auth.getSession() || { data: { session: null } };
      
      if (!session) {
        alert(t('errors.unauthorized'));
        return;
      }

      // Add to wishlist
      const wishlistResponse = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          tourId: item.tourId,
        }),
      });

      if (wishlistResponse.ok) {
        // Remove from cart
        await handleRemove(item.id);
        alert(`"${item.title}" ${t('cart.moveToWishlist')}`);
      } else {
        const data = await wishlistResponse.json();
        throw new Error(data.error || t('errors.somethingWentWrong'));
      }
    } catch (err: any) {
      console.error('Error moving to wishlist:', err);
      alert(`${t('errors.somethingWentWrong')}: ${err.message}`);
    }
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      alert(t('cart.promoCode') + ' ' + t('errors.required'));
      return;
    }

    try {
      setValidatingPromo(true);
      const response = await fetch(`/api/promo-codes/validate?code=${encodeURIComponent(promoCode.toUpperCase())}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('errors.invalidEmail'));
      }

      const data = await response.json();
      const promo = data.promoCode;

      if (!promo || !promo.is_active) {
        throw new Error(t('errors.invalidEmail'));
      }

      // Calculate discount
      let discount = 0;
      if (promo.discount_type === 'percentage') {
        discount = (subtotal * parseFloat(promo.discount_value.toString())) / 100;
      } else if (promo.discount_type === 'fixed') {
        discount = parseFloat(promo.discount_value.toString());
      }

      // Apply max discount if specified
      if (promo.max_discount && discount > parseFloat(promo.max_discount.toString())) {
        discount = parseFloat(promo.max_discount.toString());
      }

      setAppliedPromo(promoCode.toUpperCase());
      setPromoDiscount(discount);
      alert(`${t('cart.promoCode')} "${promoCode.toUpperCase()}" ${t('cart.applied')}!`);
    } catch (err: any) {
      console.error('Error applying promo:', err);
      alert(err.message || t('errors.invalidEmail'));
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoCode('');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert(t('cart.empty'));
      return;
    }
    
    // Store cart items in sessionStorage for checkout
    sessionStorage.setItem('cartItems', JSON.stringify(cartItems));
    sessionStorage.setItem('promoCode', appliedPromo || '');
    sessionStorage.setItem('promoDiscount', promoDiscount.toString());
    
    router.push('/checkout');
  };

  // Calculate totals
  const subtotal = cartItems.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    return sum + itemTotal;
  }, 0);

  const totalDiscount = cartItems.reduce((sum, item) => {
    const discount = (item.originalPrice - item.price) * item.quantity;
    return sum + discount;
  }, 0) + promoDiscount;

  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal - promoDiscount + tax;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('common.loading')}</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (error && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 mb-4">{error}</p>
            <Link
              href="/signin?redirect=/cart"
              className="inline-block px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              {t('auth.signIn')}
            </Link>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('cart.title')}</h1>
          <p className="text-gray-600">
            {cartItems.length} {cartItems.length === 1 ? t('cart.item') : t('cart.items')} {t('cart.inYourCart')}
          </p>
        </div>

        {cartItems.length === 0 ? (
          // Empty Cart
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
            <svg
              className="w-24 h-24 text-gray-300 mx-auto mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.empty')}</h2>
            <p className="text-gray-600 mb-8">{t('cart.emptyDescription')}</p>
            <Link
              href="/tours"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md hover:shadow-lg"
            >
              {t('cart.browseTours')}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Cart Items */}
            <div className="flex-1 space-y-4">
              {cartItems.map((item) => {
                const itemSubtotal = item.price * item.quantity;
                const itemDiscount = (item.originalPrice - item.price) * item.quantity;
                const hasDiscount = item.originalPrice > item.price;

                return (
                  <div
                    key={item.id}
                    className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row">
                      {/* Image */}
                      <div className="md:w-48 h-48 md:h-auto flex-shrink-0 relative">
                        <Link href={`/tour/${item.tourId}`}>
                          <Image
                            src={item.image}
                            alt={item.title}
                            fill
                            className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </Link>
                        {hasDiscount && (
                          <div className="absolute top-3 left-3 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-md">
                            {Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)}% OFF
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-4 md:p-5">
                        {/* Header: Title and Actions */}
                        <div className="flex items-start justify-between mb-3">
                          <Link href={`/tour/${item.tourId}`} className="flex-1 pr-3">
                            <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1.5 hover:text-indigo-600 transition-colors line-clamp-2 leading-tight">
                              {item.title}
                            </h3>
                          </Link>
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleMoveToWishlist(item)}
                              className="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                              title={t('cart.moveToWishlist')}
                            >
                              <HeartIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                              title={t('cart.remove')}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Info Grid: Location, Date, Time, Duration */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <MapIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.location}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <CalendarDateIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.date ? new Date(item.date).toLocaleDateString() : 'TBD'}</span>
                          </div>
                          {item.time && (
                            <div className="flex items-center gap-1">
                              <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{item.time}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="truncate">{item.duration}</span>
                          </div>
                        </div>

                        {item.pickupPoint && (
                          <div className="mb-3 text-xs text-gray-600">
                            <span className="font-medium">{t('tour.pickupLocation')}:</span> {item.pickupPoint}
                          </div>
                        )}

                        {/* Bottom Section: Price, Quantity, Subtotal */}
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pt-3 border-t border-gray-100">
                          {/* Price Section */}
                          <div className="flex items-baseline gap-2">
                            {hasDiscount && (
                              <span className="text-sm text-gray-400 line-through">
                                ${item.originalPrice}
                              </span>
                            )}
                            <span className="text-xl md:text-2xl font-bold text-indigo-600">
                              ${item.price}
                            </span>
                            <span className="text-xs text-gray-500">/ {item.priceType}</span>
                            {itemDiscount > 0 && (
                              <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                                {t('tour.discount')} ${itemDiscount.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Quantity and Subtotal Section */}
                          <div className="flex items-center gap-4">
                            {/* Quantity Selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-600 hidden sm:inline">{t('cart.quantity')}:</span>
                              <div className="flex items-center border border-gray-300 rounded-md">
                                <button
                                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  className="px-2.5 py-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-sm"
                                >
                                  −
                                </button>
                                <span className="px-3 py-1.5 min-w-[2.5rem] text-center font-semibold text-gray-900 text-sm border-x border-gray-300">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  className="px-2.5 py-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-sm"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Subtotal */}
                            <div className="text-right min-w-[80px]">
                              <p className="text-xs text-gray-500 mb-0.5">{t('cart.subtotal')}</p>
                              <p className="text-base md:text-lg font-bold text-gray-900">
                                ${itemSubtotal.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Continue Shopping */}
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
                <Link
                  href="/tours"
                  className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-semibold transition-colors"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  {t('cart.continueShopping')}
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:w-96 flex-shrink-0">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 sticky top-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('cart.orderSummary')}</h2>

                {/* Promo Code */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('cart.promoCode')}</label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-green-800">{appliedPromo}</p>
                        <p className="text-xs text-green-600">{t('cart.applied')}</p>
                      </div>
                      <button
                        onClick={handleRemovePromo}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        {t('common.remove')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleApplyPromo();
                          }
                        }}
                        placeholder={t('cart.enterCode')}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm"
                      />
                      <button
                        onClick={handleApplyPromo}
                        disabled={validatingPromo}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50"
                      >
                        {validatingPromo ? '...' : t('tour.apply')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('cart.subtotal')}</span>
                    <span className="text-gray-900 font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('tour.discount')}</span>
                      <span className="text-green-600 font-medium">-${totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('cart.tax')}</span>
                    <span className="text-gray-900 font-medium">${tax.toFixed(2)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-bold text-gray-900">{t('cart.total')}</span>
                  <span className="text-2xl font-bold text-indigo-600">${total.toFixed(2)}</span>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  className="w-full py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md hover:shadow-lg text-lg mb-4"
                >
                  {t('cart.proceedToCheckout')}
                </button>

                {/* Security Badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>{t('cart.secureCheckout')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
