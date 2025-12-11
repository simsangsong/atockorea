'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { TrashIcon, HeartIcon, CalendarDateIcon, MapIcon, ClockIcon } from '@/components/Icons';

interface CartItem {
  id: number;
  tourId: number;
  title: string;
  location: string;
  date: string;
  time: string;
  quantity: number;
  price: number;
  originalPrice: number;
  priceType: 'person' | 'group';
  image: string;
  duration: string;
}

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: 1,
      tourId: 1,
      title: 'Jeju: Eastern Jeju UNESCO Spots Day Tour',
      location: 'Jeju',
      date: '2025-03-15',
      time: '08:30 AM',
      quantity: 2,
      price: 46,
      originalPrice: 0,
      priceType: 'person',
      image: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80',
      duration: '10 hours',
    },
    {
      id: 2,
      tourId: 2,
      title: 'East Jeju UNESCO Highlights',
      location: 'Jeju',
      date: '2025-03-20',
      time: '08:00 AM',
      quantity: 1,
      price: 290,
      originalPrice: 350,
      priceType: 'group',
      image: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80',
      duration: 'Full day',
    },
    {
      id: 3,
      tourId: 3,
      title: 'Seoul Palace & Market Tour',
      location: 'Seoul',
      date: '2025-03-18',
      time: '10:00 AM',
      quantity: 3,
      price: 69,
      originalPrice: 85,
      priceType: 'person',
      image: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80',
      duration: 'Half day',
    },
  ]);

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoDiscount, setPromoDiscount] = useState(0);

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

  const handleQuantityChange = (id: number, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemove(id);
      return;
    }
    setCartItems(cartItems.map((item) => (item.id === id ? { ...item, quantity: newQuantity } : item)));
  };

  const handleRemove = (id: number) => {
    if (confirm('Remove this item from cart?')) {
      setCartItems(cartItems.filter((item) => item.id !== id));
    }
  };

  const handleMoveToWishlist = (item: CartItem) => {
    // In production, add to wishlist API
    alert(`"${item.title}" moved to wishlist`);
    setCartItems(cartItems.filter((cartItem) => cartItem.id !== item.id));
  };

  const handleApplyPromo = () => {
    if (!promoCode.trim()) {
      alert('Please enter a promo code');
      return;
    }

    // Simulate promo code validation
    const validPromos: { [key: string]: number } = {
      WELCOME10: 10,
      SAVE20: 20,
      SUMMER15: 15,
    };

    const discount = validPromos[promoCode.toUpperCase()] || 0;

    if (discount > 0) {
      setAppliedPromo(promoCode.toUpperCase());
      setPromoDiscount((subtotal * discount) / 100);
      alert(`Promo code "${promoCode.toUpperCase()}" applied! ${discount}% discount`);
    } else {
      alert('Invalid promo code');
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoCode('');
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }
    // In production, navigate to checkout page
    alert('Redirecting to checkout...');
    // router.push('/checkout');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shopping Cart</h1>
          <p className="text-gray-600">
            {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'} in your cart
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
            <p className="text-gray-600 mb-8">Start adding tours to your cart!</p>
            <Link
              href="/tours"
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md hover:shadow-lg"
            >
              Browse Tours
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
                              title="Move to Wishlist"
                            >
                              <HeartIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="p-1.5 text-gray-500 hover:text-red-600 transition-colors rounded hover:bg-red-50"
                              title="Remove"
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
                            <span className="truncate">{item.date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{item.time}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="truncate">{item.duration}</span>
                          </div>
                        </div>

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
                                Save ${itemDiscount.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Quantity and Subtotal Section */}
                          <div className="flex items-center gap-4">
                            {/* Quantity Selector */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-600 hidden sm:inline">Qty:</span>
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
                              <p className="text-xs text-gray-500 mb-0.5">Subtotal</p>
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
                  Continue Shopping
                </Link>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:w-96 flex-shrink-0">
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 sticky top-20">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Order Summary</h2>

                {/* Promo Code */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Promo Code</label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-green-800">{appliedPromo}</p>
                        <p className="text-xs text-green-600">Applied</p>
                      </div>
                      <button
                        onClick={handleRemovePromo}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        placeholder="Enter code"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none text-sm"
                      />
                      <button
                        onClick={handleApplyPromo}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium whitespace-nowrap"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>

                {/* Price Breakdown */}
                <div className="space-y-3 mb-6 pb-6 border-b border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900 font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount</span>
                      <span className="text-green-600 font-medium">-${totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax (10%)</span>
                    <span className="text-gray-900 font-medium">${tax.toFixed(2)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-indigo-600">${total.toFixed(2)}</span>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleCheckout}
                  className="w-full py-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold shadow-md hover:shadow-lg text-lg mb-4"
                >
                  Proceed to Checkout
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
                  <span>Secure checkout</span>
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

