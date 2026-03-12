'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations } from '@/lib/i18n';
import { Loader2, Plus, Trash2, Check } from 'lucide-react';
import dynamic from 'next/dynamic';

const ItineraryMapWithSearch = dynamic(
  () => import('@/components/maps/ItineraryMapWithSearch').then((m) => m.default),
  { ssr: false, loading: () => <div className="w-full h-64 rounded-2xl bg-neutral-100 animate-pulse" /> }
);
import type { DaySchedule } from '@/app/api/custom-join-tour/generate/route';
import { CUSTOM_JOIN_TOUR, getCustomJoinTourBookingTourId } from '@/lib/constants/custom-join-tour';
import { supabase } from '@/lib/supabase';

const ROBOT_ICON = '/images/robot-icon.png';

type Step = 'start' | 'ask_participants' | 'ask_vehicle' | 'ask_destination' | 'ask_date' | 'ask_language_date' | 'chat' | 'itinerary' | 'checkout' | 'confirmed';

/** 중요 구절을 볼드로 감싸서 렌더 (48 hours, 24 hours, cancelled and fully refunded 등) */
function GuaranteeBodyWithBold({ text }: { text: string }) {
  const phrases = ['48 hours', '24 hours', 'cancelled and fully refunded', '48시간', '24시간', '취소되며 전액 환불', '전액 환불'];
  const result: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    let bestIdx = -1;
    let bestLen = 0;
    let bestPhrase = '';
    for (const phrase of phrases) {
      const idx = remaining.indexOf(phrase);
      if (idx >= 0 && (bestIdx < 0 || idx < bestIdx)) {
        bestIdx = idx;
        bestLen = phrase.length;
        bestPhrase = phrase;
      }
    }
    if (bestIdx < 0) {
      result.push(remaining);
      break;
    }
    result.push(remaining.slice(0, bestIdx));
    result.push(<strong key={key++}>{bestPhrase}</strong>);
    remaining = remaining.slice(bestIdx + bestLen);
  }
  return <>{result}</>;
}

/** Tour theme keywords (pill buttons, English) with per-keyword color theme */
const TOUR_THEME_KEYWORDS: Array<{ label: string; unselected: string; selected: string }> = [
  { label: 'UNESCO Heritage', unselected: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:border-amber-300', selected: 'bg-amber-200/90 text-amber-900 border-amber-400 shadow-sm' },
  { label: 'Sunrise & Sunset', unselected: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:border-orange-300', selected: 'bg-orange-200/90 text-orange-900 border-orange-400 shadow-sm' },
  { label: 'K-Drama Locations', unselected: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300', selected: 'bg-rose-200/90 text-rose-900 border-rose-400 shadow-sm' },
  { label: 'Local Food & Cafes', unselected: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300', selected: 'bg-emerald-200/90 text-emerald-900 border-emerald-400 shadow-sm' },
  { label: 'Nature & Healing', unselected: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:border-teal-300', selected: 'bg-teal-200/90 text-teal-900 border-teal-400 shadow-sm' },
];

interface GenerateResult {
  schedule: DaySchedule[];
  dailyDistancesKm: number[];
  overLimitDays: number[];
  extraFeeNotice: string | null;
  pricing: { totalPriceKrw: number; vehicleLabelKo: string; participants: number } | null;
  guideMessage: string;
  success: boolean;
}

interface ConfirmResult {
  guideMessage: string;
  jejuCrossRegion: boolean;
  jejuCrossRegionExtraFeeKrw: number | null;
  jejuCrossRegionNotice: string | null;
  pricing: { totalPriceKrw: number; vehicleLabelKo: string } | null;
}

export default function CustomJoinTourPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPropose = searchParams.get('propose') === '1';
  const [step, setStep] = useState<Step>(isPropose ? 'ask_participants' : 'start');
  const [customerInput, setCustomerInput] = useState('');
  const [participants, setParticipants] = useState(5);
  const [destination, setDestination] = useState<'jeju' | 'busan' | 'seoul' | null>(null);
  const [tourDate, setTourDate] = useState('');
  const [departureTime, setDepartureTime] = useState('09:00');
  const [language, setLanguage] = useState('ko');
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [dailyDistancesKm, setDailyDistancesKm] = useState<number[]>([]);
  const [overLimitDays, setOverLimitDays] = useState<number[]>([]);
  const [extraFeeNotice, setExtraFeeNotice] = useState<string | null>(null);
  const [pricing, setPricing] = useState<GenerateResult['pricing']>(null);
  const [guideMessage, setGuideMessage] = useState('');
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);
  const [proposedDone, setProposedDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const itineraryRef = useRef<HTMLDivElement>(null);

  /** Checkout: customer form (same as tour checkout) */
  interface CustomerInfo {
    name: string;
    phone: string;
    email: string;
    preferredChatApp: string;
    chatAppContact: string;
  }
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: '',
    preferredChatApp: '',
    chatAppContact: '',
  });
  const [checkoutErrors, setCheckoutErrors] = useState<Partial<Record<keyof CustomerInfo, string>>>({});
  /** 선택된 테마 키워드 (토글용 배열) */
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
    setCustomerInput((prev) => {
      if (prev.includes(kw)) {
        return prev
          .replace(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
          .replace(/\s+/g, ' ')
          .trim();
      }
      return prev ? `${prev} ${kw}` : kw;
    });
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step, schedule]);

  const handleGenerate = async () => {
    const input = customerInput.trim();
    if (!input) {
      setError(t('home.customJoinTour.errorEnterRequirements') || 'Please enter your requirements.');
      return;
    }
    if (participants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS || participants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS) {
      setError(t('home.customJoinTour.errorParticipantsRange') || `Please enter ${CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS}–${CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS} guests.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/custom-join-tour/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerInput: input,
          duration: '1',
          numberOfParticipants: participants,
          destination: destination ?? 'jeju',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '일정 생성에 실패했습니다.');
        return;
      }
      setSchedule(data.schedule || []);
      setDailyDistancesKm(data.dailyDistancesKm || []);
      setOverLimitDays(data.overLimitDays || []);
      setExtraFeeNotice(data.extraFeeNotice ?? null);
      setPricing(data.pricing ? { totalPriceKrw: data.pricing.totalPriceKrw, vehicleLabelKo: data.pricing.vehicleLabelKo, participants: data.pricing.participants } : null);
      setGuideMessage(data.guideMessage || '');
      // Confirm immediately and go straight to checkout (skip itinerary editing)
      const confirmRes = await fetch('/api/custom-join-tour/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule: data.schedule || [], numberOfParticipants: participants }),
      });
      const confirmData = await confirmRes.json();
      if (confirmRes.ok && confirmData.pricing) {
        setConfirmResult(confirmData);
        setStep('checkout');
      } else {
        setStep('itinerary');
      }
      itineraryRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const updatePlace = (dayIndex: number, placeIndex: number, field: 'name' | 'address', value: string) => {
    setSchedule((prev) => {
      const next = prev.map((d, i) => {
        if (i !== dayIndex) return d;
        return {
          ...d,
          places: d.places.map((p, j) => (j === placeIndex ? { ...p, [field]: value } : p)),
        };
      });
      return next;
    });
  };

  const addPlace = (dayIndex: number) => {
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, places: [...d.places, { name: '', address: '' }] } : d
      )
    );
  };

  const removePlace = (dayIndex: number, placeIndex: number) => {
    setSchedule((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const places = d.places.filter((_, j) => j !== placeIndex);
        return { ...d, places: places.length ? places : [{ name: '', address: '' }] };
      })
    );
  };

  const addPlaceFromSearch = (dayIndex: number, name: string, address: string) => {
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, places: [...d.places, { name, address }] } : d
      )
    );
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/custom-join-tour/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule, numberOfParticipants: participants }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '확정 처리에 실패했습니다.');
        return;
      }
      setConfirmResult(data);
      setStep('confirmed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '확정 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handlePropose = async () => {
    if (!confirmResult?.pricing || proposedDone) return;
    setLoading(true);
    setError(null);
    const title =
      schedule.length > 0 && schedule[0].places?.length > 0
        ? `${schedule[0].places[0].name || '맞춤'} 외 ${schedule.length}일`
        : `맞춤 투어 ${schedule.length}일`;
    try {
      const res = await fetch('/api/custom-join-tour/proposed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          schedule,
          participants,
          vehicle_type: participants <= 6 ? 'van' : 'large_van',
          total_price_krw: confirmResult.pricing.totalPriceKrw,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발의에 실패했습니다.');
      setProposedDone(true);
      router.push('/custom-join-tour/proposed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '발의에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getMinTourDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  };

  /** Checkout: validate 48h before tour start (proposal deadline) */
  const isTourDateAtLeast48h = () => {
    if (!tourDate || !departureTime) return false;
    const [h, m] = departureTime.split(':').map(Number);
    const start = new Date(tourDate);
    start.setHours(h, m || 0, 0, 0);
    const now = new Date();
    return start.getTime() - now.getTime() >= 48 * 60 * 60 * 1000;
  };

  const validateCheckoutForm = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerInfo, string>> = {};
    const name = customerInfo.name.trim();
    const phone = customerInfo.phone.trim();
    const email = customerInfo.email.trim();
    if (!name) newErrors.name = (t('errors.pleaseEnter') || 'Please enter') + ' ' + (t('booking.fullName') || 'name').toLowerCase();
    else if (name.length < 2) newErrors.name = t('errors.invalidName') || 'Name must be at least 2 characters';
    else if (name.length > 100) newErrors.name = t('errors.nameTooLong') || 'Name must be at most 100 characters';
    if (!phone) newErrors.phone = (t('errors.pleaseEnter') || 'Please enter') + ' ' + (t('booking.phone') || 'phone').toLowerCase();
    else {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 8) newErrors.phone = t('errors.phoneTooShort') || 'Phone must have at least 8 digits';
      else if (digits.length > 15) newErrors.phone = t('errors.phoneTooLong') || 'Phone must have at most 15 digits';
    }
    if (!email) newErrors.email = (t('errors.pleaseEnter') || 'Please enter') + ' ' + (t('booking.email') || 'email').toLowerCase();
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = t('errors.invalidEmail') || 'Invalid email';
    if (!customerInfo.preferredChatApp.trim()) newErrors.preferredChatApp = (t('errors.pleaseSelect') || 'Please select') + ' ' + (t('tour.preferredChatApp') || 'chat app').toLowerCase();
    if (!customerInfo.chatAppContact.trim()) newErrors.chatAppContact = (t('errors.pleaseEnter') || 'Please enter') + ' ' + (t('tour.chatAppContact') || 'chat contact').toLowerCase();
    setCheckoutErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCheckoutSubmit = async () => {
    if (!confirmResult?.pricing || !tourDate || !departureTime) {
      setError(t('home.customJoinTour.errorDateAndTime') || 'Please set tour date and departure time.');
      return;
    }
    if (!isTourDateAtLeast48h()) {
      setError(t('home.customJoinTour.errorProposal48h') || 'Tour must be proposed at least 48 hours before the desired start time.');
      return;
    }
    if (!validateCheckoutForm()) return;
    setError(null);
    setLoading(true);
    try {
      const title = customerInput.trim().slice(0, 100) || 'Custom Join Tour';
      const proposeRes = await fetch('/api/custom-join-tour/proposed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary: customerInput.trim() || null,
          schedule,
          participants,
          vehicle_type: participants <= 6 ? 'van' : 'large_van',
          total_price_krw: confirmResult.pricing.totalPriceKrw,
        }),
      });
      const proposeData = await proposeRes.json();
      if (!proposeRes.ok) {
        setError(proposeData.error || 'Failed to save tour proposal.');
        return;
      }
      setProposedDone(true);

      const tourId = getCustomJoinTourBookingTourId();
      const bookingDateIso = `${tourDate}T${departureTime}:00`;
      const bookingPayload = {
        tourId: String(tourId),
        bookingDate: bookingDateIso,
        numberOfGuests: participants,
        pickupPointId: null,
        finalPrice: confirmResult.pricing.totalPriceKrw,
        paymentMethod: 'full',
        preferredLanguage: language || 'en',
        specialRequests: JSON.stringify({ proposedTourId: proposeData.id, schedule, preferredChatApp: customerInfo.preferredChatApp, chatAppContact: customerInfo.chatAppContact }),
        customerInfo: {
          name: customerInfo.name,
          email: customerInfo.email,
          phone: customerInfo.phone,
          preferredChatApp: customerInfo.preferredChatApp,
          chatAppContact: customerInfo.chatAppContact,
        },
      };

      if (tourId) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const { data: { session } } = await supabase?.auth.getSession() ?? { data: { session: null } };
        if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

        const bookingRes = await fetch('/api/bookings', { method: 'POST', headers, body: JSON.stringify(bookingPayload) });
        const bookingJson = await bookingRes.json().catch(() => ({}));
        if (!bookingRes.ok) {
          setError(bookingJson.error || bookingJson.details?.[0] || 'Failed to create booking.');
          return;
        }
        const bookingId = bookingJson.booking?.id;
        if (!bookingId) {
          setError('Booking created but ID missing.');
          return;
        }
        const payRes = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: confirmResult.pricing.totalPriceKrw,
            currency: 'krw',
            bookingId,
            bookingData: { ...bookingPayload, bookingId, customerInfo },
          }),
        });
        const payData = await payRes.json();
        if (payRes.ok && payData.url) {
          window.location.href = payData.url;
          return;
        }
        setError(payData.error || 'Payment could not be started.');
      } else {
        setStep('confirmed');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed.');
    } finally {
      setLoading(false);
    }
  };

  /** Prefill customer info from session (same as tour checkout) */
  useEffect(() => {
    if (step !== 'checkout' || !supabase) return;
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted || !session?.user) return;
      const name = (session.user.user_metadata?.full_name as string) || '';
      const email = session.user.email || '';
      if (!name && !email) return;
      const { data: profile } = await supabase.from('user_profiles').select('full_name, phone').eq('id', session.user.id).single();
      if (!mounted) return;
      setCustomerInfo((prev) => ({
        ...prev,
        name: prev.name || (profile?.full_name ?? name) || '',
        email: prev.email || email || '',
        phone: prev.phone || (profile?.phone ?? '') || '',
      }));
    })();
    return () => { mounted = false; };
  }, [step]);

  /** One-page form: show when not yet on itinerary, checkout, or confirmed */
  const showDashboard = step !== 'itinerary' && step !== 'checkout' && step !== 'confirmed';

  const fieldClass = 'w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 outline-none appearance-none cursor-pointer transition-colors';
  const labelClass = 'block text-[11px] font-bold text-black uppercase tracking-wider mb-1.5 ml-1';

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-6xl">
        {/* App-like Dashboard */}
        {showDashboard && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-[2rem] shadow-[0_10px_40px_rgb(0,0,0,0.06)] overflow-hidden border border-slate-100">
              {isPropose && (
                <div className="px-6 pt-6">
                  <Link href="/custom-join-tour/proposed" className="text-[11px] text-sky-600 hover:underline font-medium">
                    ← {t('home.customJoinTour.backToProposed')}
                  </Link>
                </div>
              )}

              {/* Header: 이전 스타일 (다크 바) */}
              <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex items-center">
                <span className="bg-cyan-500/20 text-cyan-400 p-1.5 rounded-lg mr-3" aria-hidden>🤖</span>
                <h2 className="text-lg font-bold text-white tracking-tight">{t('home.customJoinTour.pageTitle')}</h2>
              </div>

              <div className="p-6 md:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* 1. 기본 정보 (좌측) */}
                <div className="lg:col-span-5 space-y-5">
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-4 border border-slate-100">
                    <div>
                      <label className={labelClass}>{t('home.customJoinTour.destinationLabel')}</label>
                      <select
                        value={destination ?? 'jeju'}
                        onChange={(e) => setDestination((e.target.value as 'jeju' | 'busan' | 'seoul') || null)}
                        className={fieldClass}
                      >
                        <option value="jeju">📍 {t('home.customJoinTour.cityJejuOption')}</option>
                        <option value="busan" disabled>📍 {t('home.customJoinTour.cityBusanOption')} ({t('home.customJoinTour.comingSoon')})</option>
                        <option value="seoul" disabled>📍 {t('home.customJoinTour.citySeoulOption')} ({t('home.customJoinTour.comingSoon')})</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>{t('home.customJoinTour.tourDateLabel')}</label>
                        <input
                          type="date"
                          min={getMinTourDate()}
                          value={tourDate}
                          onChange={(e) => setTourDate(e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>{t('home.customJoinTour.departureTime')}</label>
                        <input
                          type="time"
                          value={departureTime}
                          onChange={(e) => setDepartureTime(e.target.value)}
                          className={fieldClass}
                          title={t('home.customJoinTour.departureTime')}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>{t('home.customJoinTour.guideLanguage')}</label>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="ko">🇰🇷 {t('home.customJoinTour.guideKorean')}</option>
                        <option value="en">🇺🇸 {t('home.customJoinTour.guideEnglish')}</option>
                        <option value="zh">🇨🇳 {t('home.customJoinTour.guideChinese')}</option>
                        <option value="ja">🇯🇵 日本語</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 ml-1">
                      <label className="text-[11px] font-bold text-black uppercase tracking-wider">{t('home.customJoinTour.guestsAndVehicleLabel')}</label>
                      <input
                        type="number"
                        min={CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS}
                        max={CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS}
                        value={participants}
                        onChange={(e) => setParticipants(Math.min(CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS, Math.max(CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS, Number(e.target.value) || 5)))}
                        className="w-16 bg-slate-100 border-none rounded-lg px-2 py-1.5 text-center text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="cursor-pointer group">
                        <input
                          type="radio"
                          name="vehicle"
                          className="peer sr-only"
                          checked={participants <= 6}
                          onChange={() => setParticipants((p) => Math.min(6, p))}
                        />
                        <div className="p-3 border-2 border-slate-100 rounded-xl peer-checked:border-slate-900 peer-checked:bg-slate-900 transition-all text-center text-slate-800 group-has-[:checked]:text-white">
                          <div className="font-bold text-sm mb-0.5 group-has-[:checked]:text-white">{t('home.customJoinTour.vehicleVanLabel')}</div>
                          <div className="text-[11px] text-slate-500 group-has-[:checked]:text-slate-200">{t('home.customJoinTour.vehicleVanPrice')}</div>
                        </div>
                      </label>
                      <label className="cursor-pointer group">
                        <input
                          type="radio"
                          name="vehicle"
                          className="peer sr-only"
                          checked={participants >= 7}
                          onChange={() => setParticipants((p) => Math.max(7, p))}
                        />
                        <div className="p-3 border-2 border-slate-100 rounded-xl peer-checked:border-slate-900 peer-checked:bg-slate-900 transition-all text-center text-slate-800 group-has-[:checked]:text-white">
                          <div className="font-bold text-sm mb-0.5 group-has-[:checked]:text-white">{t('home.customJoinTour.vehicleLargeVanLabel')}</div>
                          <div className="text-[11px] text-slate-500 group-has-[:checked]:text-slate-200">{t('home.customJoinTour.vehicleLargeVanPrice')}</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. AI 취향 (우측) */}
                <div className="lg:col-span-7 flex flex-col">
                  <div className="mb-5">
                    <label className={`${labelClass} mb-2`}>{t('home.customJoinTour.themeLabel')}</label>
                    <div className="flex flex-wrap gap-1.5">
                      {TOUR_THEME_KEYWORDS.map(({ label, unselected, selected }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => toggleKeyword(label)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border ${
                            selectedKeywords.includes(label) ? selected : unselected
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex-grow flex flex-col mb-6">
                    <label className={`${labelClass} mb-2`}>{t('home.customJoinTour.describeLabel')}</label>
                    <div className="relative flex-grow min-h-[120px]">
                      <textarea
                        rows={5}
                        value={customerInput}
                        onChange={(e) => setCustomerInput(e.target.value)}
                        placeholder={t('home.customJoinTour.describePlaceholder')}
                        className="w-full h-full min-h-[140px] bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm text-slate-700 focus:ring-2 focus:ring-slate-900 focus:bg-white outline-none resize-none transition-colors placeholder:text-slate-400 placeholder:text-sm"
                      />
                      <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 font-medium bg-white px-2 py-1 rounded-md shadow-sm border border-slate-100">AI Powered ✨</div>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-auto pt-4 border-t border-slate-100">
                    <p className="text-xs text-black leading-snug flex-1">
                      <strong>{t('home.customJoinTour.departureGuaranteeTitle')}</strong>{' '}
                      <GuaranteeBodyWithBold text={t('home.customJoinTour.departureGuaranteeBody')} />
                      {' '}
                      {t('home.customJoinTour.departureGuaranteeMinPax')}
                    </p>
                    <button
                      type="button"
                      onClick={handleGenerate}
                      disabled={loading}
                      className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white text-sm font-bold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 inline-flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {t('home.customJoinTour.generateButton')} ✨
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Itinerary — 편집 가능 일정 */}
        {step === 'itinerary' && (
          <div ref={itineraryRef} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
            <button type="button" onClick={() => setStep('chat')} className="text-xs text-sky-600 hover:underline font-medium">
              ← {t('home.customJoinTour.editRequirements')}
            </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="text-xs text-neutral-600 hover:text-neutral-900 font-medium"
              >
                {t('home.customJoinTour.regenerate')}
              </button>
            </div>
            <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-100 p-5 sm:p-6">
              <h2 className="text-base font-bold text-neutral-900 mb-4">{t('home.customJoinTour.itineraryTitle')}</h2>
              {guideMessage && (
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-4 py-3 text-xs text-sky-800 mb-4">
                  {guideMessage}
                </div>
              )}
              {extraFeeNotice && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800 mb-4">
                  {extraFeeNotice}
                </div>
              )}
              {pricing && (
                <div className="rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-800 mb-4">
                  {pricing.vehicleLabelKo} · {participants}명 · 총 {(pricing.totalPriceKrw / 10000).toFixed(0)}만 원
                </div>
              )}
              <div className="space-y-4">
                {schedule.map((daySchedule, dayIndex) => (
                  <div key={daySchedule.day} className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-900">
                      {t('home.customJoinTour.dayLabel').replace('{{n}}', String(daySchedule.day))}
                    </h3>
                    {dailyDistancesKm[dayIndex] != null && (
                      <span className="text-xs text-gray-500">이동 거리 약 {dailyDistancesKm[dayIndex]} km</span>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {daySchedule.places.map((place, placeIndex) => (
                      <li key={placeIndex} className="flex gap-2 items-start border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                        <span className="text-gray-400 mt-2 w-6 shrink-0">{placeIndex + 1}.</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={place.name}
                              onChange={(e) => updatePlace(dayIndex, placeIndex, 'name', e.target.value)}
                              placeholder={t('home.customJoinTour.placeName')}
                              className="flex-1 min-w-0 rounded border border-gray-200 px-2 py-1.5 text-sm"
                            />
                            {(place as { type?: string }).type === 'restaurant' && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">식당</span>
                            )}
                          </div>
                          <input
                            type="text"
                            value={place.address}
                            onChange={(e) => updatePlace(dayIndex, placeIndex, 'address', e.target.value)}
                            placeholder={t('home.customJoinTour.address')}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs text-gray-600"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removePlace(dayIndex, placeIndex)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                          aria-label={t('home.customJoinTour.removePlace')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => addPlace(dayIndex)}
                    className="mt-2 flex items-center gap-1 text-xs text-sky-600 hover:text-sky-800 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {t('home.customJoinTour.addPlace')}
                  </button>
                </div>
              ))}
              </div>

              <div className="mt-6">
                <ItineraryMapWithSearch
                  schedule={schedule}
                  onAddPlace={addPlaceFromSearch}
                  destination={destination ?? 'jeju'}
                />
              </div>

              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-neutral-900/90 backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 hover:bg-neutral-800/95 disabled:opacity-70 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {loading ? '검수 중…' : t('home.customJoinTour.confirmItinerary')}
              </button>
            </div>
          </div>
        )}

        {/* Step: Checkout — Notice + customer form + payment */}
        {step === 'checkout' && confirmResult && (
          <div ref={itineraryRef} className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-amber-900 mb-2">{t('home.customJoinTour.noticeTitle')}</h3>
              <ul className="text-sm text-amber-800 space-y-1.5 list-disc list-inside">
                <li>{t('home.customJoinTour.notice24hCancel')}</li>
                <li>{t('home.customJoinTour.notice48hProposal')}</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-100 p-5 sm:p-6">
                  <h2 className="text-lg font-bold text-neutral-900 mb-4">{t('booking.customerInfo')}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1">{t('booking.fullName')} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={customerInfo.name}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, name: e.target.value })); setCheckoutErrors((e) => ({ ...e, name: undefined })); }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-gray-50/50 focus:bg-white ${checkoutErrors.name ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                        placeholder={t('booking.enterFullName')}
                      />
                      {checkoutErrors.name && <p className="mt-1 text-sm text-red-500">{checkoutErrors.name}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1">{t('booking.phone')} <span className="text-red-500">*</span></label>
                      <input
                        type="tel"
                        value={customerInfo.phone}
                        onChange={(e) => { const v = e.target.value.replace(/[^0-9+]/g, ''); setCustomerInfo((c) => ({ ...c, phone: v })); setCheckoutErrors((e) => ({ ...e, phone: undefined })); }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-gray-50/50 focus:bg-white ${checkoutErrors.phone ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                        placeholder={t('booking.enterPhone')}
                      />
                      {checkoutErrors.phone && <p className="mt-1 text-sm text-red-500">{checkoutErrors.phone}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1">{t('booking.email')} <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={customerInfo.email}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, email: e.target.value })); setCheckoutErrors((e) => ({ ...e, email: undefined })); }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-gray-50/50 focus:bg-white ${checkoutErrors.email ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                        placeholder={t('booking.enterEmail')}
                      />
                      {checkoutErrors.email && <p className="mt-1 text-sm text-red-500">{checkoutErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1">{t('tour.preferredChatApp')} <span className="text-red-500">*</span></label>
                      <select
                        value={customerInfo.preferredChatApp}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, preferredChatApp: e.target.value })); setCheckoutErrors((e) => ({ ...e, preferredChatApp: undefined })); }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-gray-50/50 focus:bg-white appearance-none ${checkoutErrors.preferredChatApp ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                      >
                        <option value="">{t('tour.pleaseSelect')}</option>
                        <option value="kakao">KakaoTalk</option>
                        <option value="line">LINE</option>
                        <option value="wechat">WeChat</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telegram">Telegram</option>
                        <option value="other">Other</option>
                      </select>
                      {checkoutErrors.preferredChatApp && <p className="mt-1 text-sm text-red-500">{checkoutErrors.preferredChatApp}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-1">{t('tour.chatAppContact')} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={customerInfo.chatAppContact}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, chatAppContact: e.target.value })); setCheckoutErrors((e) => ({ ...e, chatAppContact: undefined })); }}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none bg-gray-50/50 focus:bg-white ${checkoutErrors.chatAppContact ? 'border-red-400 bg-red-50/50' : 'border-gray-200'}`}
                        placeholder={customerInfo.preferredChatApp === 'line' ? t('tour.enterLineLink') : t('tour.enterChatAppId')}
                      />
                      {checkoutErrors.chatAppContact && <p className="mt-1 text-sm text-red-500">{checkoutErrors.chatAppContact}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-100 p-5 sticky top-24">
                  <h2 className="text-lg font-bold text-neutral-900 mb-4">{t('booking.bookingSummary')}</h2>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('booking.tourDate')}</label>
                      <input
                        type="date"
                        min={getMinTourDate()}
                        value={tourDate}
                        onChange={(e) => setTourDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('home.customJoinTour.departureTime')}</label>
                      <input
                        type="time"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-3 text-sm pt-2 border-t border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('booking.tourDate')}</span>
                      <span className="font-semibold text-gray-900">
                        {tourDate || '—'} {departureTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">{t('tour.guests')}</span>
                      <span className="font-semibold text-gray-900">{participants}</span>
                    </div>
                    {confirmResult.pricing && (
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="text-gray-600">{t('tour.total')}</span>
                        <span className="text-lg font-bold text-gray-900">₩{(confirmResult.pricing.totalPriceKrw / 10000).toFixed(0)}만</span>
                      </div>
                    )}
                  </div>
                  {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    disabled={loading}
                    className="mt-4 w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-[0_4px_12px_rgba(37,99,235,0.4)]"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('home.customJoinTour.proceedToPayment')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Confirmed — 확정 결과 + 제주 동서 추가요금 안내 */}
        {step === 'confirmed' && confirmResult && (
          <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-100 p-5 sm:p-6 space-y-4">
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <Check className="w-6 h-6" />
              </div>
              <h2 className="text-base font-bold text-neutral-900 mb-1">{t('home.customJoinTour.confirmSuccess')}</h2>
              <p className="text-sm text-neutral-600">{confirmResult.guideMessage}</p>
            </div>
            {confirmResult.pricing && (
              <div className="rounded-xl bg-neutral-100 px-4 py-3 text-xs text-neutral-800">
                {confirmResult.pricing.vehicleLabelKo} · 총 {(confirmResult.pricing.totalPriceKrw / 10000).toFixed(0)}만 원
              </div>
            )}
            {confirmResult.jejuCrossRegion && confirmResult.jejuCrossRegionNotice && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-semibold text-amber-900 mb-1">{t('home.customJoinTour.jejuCrossRegionTitle')}</p>
                <p className="text-[11px] text-amber-800">{confirmResult.jejuCrossRegionNotice}</p>
                {confirmResult.jejuCrossRegionExtraFeeKrw != null && (
                  <p className="text-[11px] font-medium text-amber-900 mt-2">
                    {t('home.customJoinTour.jejuCrossRegionExtraFee', { amount: (confirmResult.jejuCrossRegionExtraFeeKrw / 10000).toFixed(0) })}
                  </p>
                )}
              </div>
            )}
            {!proposedDone ? (
              <button
                type="button"
                onClick={handlePropose}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-neutral-900/90 backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 hover:bg-neutral-800/95 disabled:opacity-70 transition-colors"
              >
                {loading ? '처리 중…' : t('home.customJoinTour.proposeThisTour')}
              </button>
            ) : (
              <p className="text-xs text-emerald-600 font-medium py-2">{t('home.customJoinTour.proposedDone')}</p>
            )}
            <Link
              href="/custom-join-tour/proposed"
              className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-sky-600 border-2 border-sky-500 hover:bg-sky-50 transition"
            >
              {t('home.proposedTours.viewAll')}
            </Link>
            <Link
              href="/tours"
              className="block w-full text-center py-2 rounded-xl text-xs text-neutral-600 hover:underline"
            >
              {t('home.customJoinTour.viewFixedTours')}
            </Link>
          </div>
        )}
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}
