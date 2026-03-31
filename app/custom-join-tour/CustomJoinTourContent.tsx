'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations, useI18n, useCopy } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';
import { Loader2, Plus, Trash2, Check, ChevronUp, ChevronDown, UtensilsCrossed } from 'lucide-react';
import { AiInputSparkleIcon } from '@/components/Icons';
import { motion, AnimatePresence } from 'framer-motion';
import BuilderLoadingOverlay from '@/components/BuilderLoadingOverlay';
import CustomCalendar from '@/components/CustomCalendar';
import { CustomTimePicker, CustomSelect, PREMIUM_GLASS_SURFACE, PREMIUM_GLASS_TEXTAREA_CLASS } from '@/components/CustomPicker';
import dynamic from 'next/dynamic';

const ItineraryMapWithSearch = dynamic(
  () => import('@/components/maps/ItineraryMapWithSearch').then((m) => m.default),
  { ssr: false, loading: () => <div className="w-full h-64 rounded-2xl bg-neutral-100 animate-pulse" /> }
);
import type { DaySchedule } from '@/app/api/custom-join-tour/generate/route';
import { CUSTOM_JOIN_TOUR, getCustomJoinTourBookingTourId, getHotelLocationFromAddress, haversineDistanceKm, CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM, type HotelLocation } from '@/lib/constants/custom-join-tour';
import type { HotelInfo } from '@/components/maps/HotelMapPicker';
import type { ProposedTourItem } from '@/app/api/custom-join-tour/proposed/route';

const HotelMapPicker = dynamic(() => import('@/components/maps/HotelMapPicker').then((m) => m.default), { ssr: false });
import { supabase } from '@/lib/supabase';

const STORAGE_KEY_ITINERARY = 'customJoinTourGenerated'; // localStorage so new tab can read

function playGlitchSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }
}

const ROBOT_ICON = '/images/robot-icon.png';

type Step = 'start' | 'ask_participants' | 'ask_vehicle' | 'ask_destination' | 'ask_date' | 'ask_language_date' | 'chat' | 'itinerary' | 'checkout' | 'confirmed';

/** Guarantee policy text renderer with bold phrases (48 hours, 24 hours, cancelled and fully refunded) */
function GuaranteeBodyWithBold({ text }: { text: string }) {
  const phrases = ['48 hours', '24 hours', 'cancelled and fully refunded', '48시간', '24시간', '취소 및 전액 환불', '전액 환불'];
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

/** Format price in KRW for display: numeric. Uses currency context for USD when selected. */
function usePriceFormat() {
  const currency = useCurrencyOptional();
  const { locale } = useI18n();
  return (priceKRW: number) => {
    if (currency?.formatPrice) return currency.formatPrice(priceKRW);
    return new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(priceKRW);
  };
}

export default function CustomJoinTourContent() {
  const t = useTranslations();
  const { locale } = useI18n();
  const copy = useCopy();
  const formatPrice = usePriceFormat();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPropose = searchParams?.get('propose') === '1';
  const [step, setStep] = useState<Step>(isPropose ? 'ask_participants' : 'start');
  const [customerInput, setCustomerInput] = useState('');
  const [participants, setParticipants] = useState(5);
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null);
  const [hotelMapOpen, setHotelMapOpen] = useState(false);
  const [proposedTourToJoin, setProposedTourToJoin] = useState<ProposedTourItem | null>(null);
  const [joinDistanceError, setJoinDistanceError] = useState<string | null>(null);
  const [joinProposedId, setJoinProposedId] = useState<string | null>(null);
  const [destination, setDestination] = useState<'jeju' | 'busan' | 'seoul' | null>(null);
  const hotelLocation: HotelLocation = hotelInfo ? getHotelLocationFromAddress(hotelInfo.address) : 'jeju_city';
  const joinId = searchParams?.get('join') ?? null;
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
  const [showGenerateOverlay, setShowGenerateOverlay] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(false);
  const generateOverlayPlayedSound = useRef(false);

  /** Checkout: customer form (same as tour checkout) */
  interface CustomerInfo {
    name: string;
    phone: string;
    email: string;
    preferredChatApp: string;
    chatAppContact: string;
  }
  type CheckoutErrorsState = Partial<Record<keyof CustomerInfo, string> >;
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    phone: '',
    email: '',
    preferredChatApp: '',
    chatAppContact: '',
  });
  const [checkoutErrors, setCheckoutErrors] = useState<CheckoutErrorsState>({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [step, schedule]);

  /** Join mode: fetch proposed tour by id */
  useEffect(() => {
    if (!joinId) {
      setProposedTourToJoin(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/custom-join-tour/proposed?id=${encodeURIComponent(joinId)}`)
      .then((res) => res.json())
      .then((data: { proposedTour?: ProposedTourItem | null }) => {
        if (!cancelled && data.proposedTour) setProposedTourToJoin(data.proposedTour);
        else if (!cancelled) setProposedTourToJoin(null);
      })
      .catch(() => { if (!cancelled) setProposedTourToJoin(null); });
    return () => { cancelled = true; };
  }, [joinId]);

  /** Join mode: when hotel selected, check distance from proposer hotel */
  useEffect(() => {
    if (!proposedTourToJoin || !hotelInfo) {
      setJoinDistanceError(null);
      return;
    }
    const lat = proposedTourToJoin.hotel_lat;
    const lng = proposedTourToJoin.hotel_lng;
    if (lat == null || lng == null) {
      setJoinDistanceError(null);
      return;
    }
    const km = haversineDistanceKm(lat, lng, hotelInfo.lat, hotelInfo.lng);
    if (km > CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM) {
      setJoinDistanceError(t('home.customJoinTour.joinHotelTooFar') ?? `호텔이 직선 거리 ${CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM}km를 초과해 참가할 수 없습니다.`);
    } else {
      setJoinDistanceError(null);
    }
  }, [proposedTourToJoin, hotelInfo, t]);

  const proceedToJoinTour = useCallback(() => {
    if (!proposedTourToJoin || !hotelInfo || joinDistanceError) return;
    const lat = proposedTourToJoin.hotel_lat;
    const lng = proposedTourToJoin.hotel_lng;
    if (lat != null && lng != null) {
      const km = haversineDistanceKm(lat, lng, hotelInfo.lat, hotelInfo.lng);
      if (km > CUSTOM_JOIN_TOUR_MAX_HOTEL_DISTANCE_KM) return;
    }
    setSchedule(proposedTourToJoin.schedule.map((d) => ({ ...d, places: d.places.map((p) => ({ ...p, _uid: `p-${d.day}-${p.name}-${Date.now()}` })) })));
    setConfirmResult({
      guideMessage: '참가 신청이 가능합니다. 결제를 진행해 주세요.',
      jejuCrossRegion: false,
      jejuCrossRegionExtraFeeKrw: null,
      jejuCrossRegionNotice: null,
      pricing: {
        totalPriceKrw: proposedTourToJoin.total_price_krw,
        vehicleLabelKo: proposedTourToJoin.vehicle_type === 'large_van' ? CUSTOM_JOIN_TOUR.LARGE_VAN.LABEL_KO : CUSTOM_JOIN_TOUR.VAN.LABEL_KO,
      },
    });
    setParticipants(proposedTourToJoin.participants);
    setJoinProposedId(proposedTourToJoin.id);
    setStep('checkout');
  }, [proposedTourToJoin, hotelInfo, joinDistanceError]);

  /** Restore itinerary from localStorage when opened in new tab */
  useEffect(() => {
    if (searchParams?.get('open') !== 'itinerary') return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY_ITINERARY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as { schedule: DaySchedule[]; dailyDistancesKm: number[]; overLimitDays: number[]; extraFeeNotice: string | null; pricing: GenerateResult['pricing']; guideMessage: string };
      setSchedule((data.schedule || []).map((d: DaySchedule, di: number) => ({
        ...d,
        places: d.places.map((p, pi) => ({ ...p, _uid: (p as { _uid?: string })._uid ?? `p-${di}-${pi}-${Date.now()}` })),
      })));
      setDailyDistancesKm(data.dailyDistancesKm || []);
      setOverLimitDays(data.overLimitDays || []);
      setExtraFeeNotice(data.extraFeeNotice ?? null);
      setPricing(data.pricing ?? null);
      setGuideMessage(data.guideMessage || '');
      setStep('itinerary');
    } catch { /* ignore */ }
  }, [searchParams]);

  const handleGenerate = async () => {
    const input = customerInput.trim();
    if (!input) {
      setError(t('home.customJoinTour.errorEnterRequirements') || 'Please enter your requirements.');
      setShowGenerateOverlay(false);
      return;
    }
    if (!hotelInfo) {
      setError(t('home.customJoinTour.errorHotelRequired') || 'Please enter hotel information.');
      setShowGenerateOverlay(false);
      return;
    }
    if (participants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS || participants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS) {
      setError(t('home.customJoinTour.errorParticipantsRange') || `Please enter ${CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS}-${CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS} guests.`);
      setShowGenerateOverlay(false);
      return;
    }
    if (!tourDate) {
      setError(t('home.customJoinTour.errorSelectDate') || 'Please select a tour date.');
      setShowGenerateOverlay(false);
      return;
    }
    setError(null);

    // Only show overlay + play sound after validation passes
    setShowGenerateOverlay(true);
    if (!generateOverlayPlayedSound.current) {
      generateOverlayPlayedSound.current = true;
      playGlitchSound();
    }

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
          hotelLocation,
          hotelAddress: hotelInfo.address,
          hotelLat: hotelInfo.lat,
          hotelLng: hotelInfo.lng,
          placeLang: locale,
          ...(tourDate ? { tourStartDate: tourDate } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '일정 생성에 실패했습니다.');
        return;
      }
      setSchedule((data.schedule || []).map((d: DaySchedule, di: number) => ({
        ...d,
        places: d.places.map((p, pi) => ({ ...p, _uid: `p-${di}-${pi}-${Date.now()}-${Math.random().toString(36).slice(2)}` })),
      })));
      setDailyDistancesKm(data.dailyDistancesKm || []);
      setOverLimitDays(data.overLimitDays || []);
      setExtraFeeNotice(data.extraFeeNotice ?? null);
      setPricing(data.pricing ? { totalPriceKrw: data.pricing.totalPriceKrw, vehicleLabelKo: data.pricing.vehicleLabelKo, participants: data.pricing.participants } : null);
      const removedNotice = Array.isArray(data.removedPlaces) && data.removedPlaces.length > 0
        ? ` (제외된 장소: ${(data.removedPlaces as Array<{ name: string; reason: string }>).map((r) => `${r.name}`).join(', ')})`
        : '';

      // Localize AI guide message based on current UI locale
      const successMessage =
        locale === 'ko'
          ? t('home.customJoinTour.verifySuccessKo')
          : locale === 'ja'
            ? t('home.customJoinTour.verifySuccessJa')
            : locale === 'zh'
              ? t('home.customJoinTour.verifySuccessZh')
              : locale === 'zh-TW'
                ? t('home.customJoinTour.verifySuccessZhTw')
                : locale === 'es'
                  ? t('home.customJoinTour.verifySuccessEs')
                  : t('home.customJoinTour.verifySuccessEn');

      setGuideMessage(successMessage + removedNotice);
      const payload = {
        schedule: data.schedule || [],
        dailyDistancesKm: data.dailyDistancesKm || [],
        overLimitDays: data.overLimitDays || [],
        extraFeeNotice: data.extraFeeNotice ?? null,
        pricing: data.pricing ? { totalPriceKrw: data.pricing.totalPriceKrw, vehicleLabelKo: data.pricing.vehicleLabelKo, participants: data.pricing.participants } : null,
        guideMessage: (data.guideMessage || '') + removedNotice,
      };
      try {
        window.localStorage.setItem(STORAGE_KEY_ITINERARY, JSON.stringify(payload));
        setGenerateSuccess(true);
        setTimeout(() => {
          setGenerateSuccess(false);
          router.push(`${window.location.pathname}?open=itinerary`);
          setShowGenerateOverlay(false);
        }, 1800);
      } catch {
        setShowGenerateOverlay(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정 생성에 실패했습니다.');
      setShowGenerateOverlay(false);
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
        i === dayIndex ? { ...d, places: [...d.places, { name: '', address: '', _uid: `p-${dayIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}` }] } : d
      )
    );
  };

  const removePlace = (dayIndex: number, placeIndex: number) => {
    setSchedule((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const places = d.places.filter((_, j) => j !== placeIndex);
        return {
          ...d,
          places: places.length ? places : [{ name: '', address: '', _uid: `p-${dayIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}` }],
        };
      })
    );
  };

  const movePlace = (dayIndex: number, fromIndex: number, direction: 'up' | 'down') => {
    setSchedule((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d;
        const places = [...d.places];
        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= places.length) return d;
        [places[fromIndex], places[toIndex]] = [places[toIndex], places[fromIndex]];
        return { ...d, places };
      })
    );
  };

  const addPlaceFromSearch = (dayIndex: number, name: string, address: string) => {
    setSchedule((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, places: [...d.places, { name, address, _uid: `p-${dayIndex}-${Date.now()}-${Math.random().toString(36).slice(2)}` }] } : d
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
        body: JSON.stringify({ schedule, numberOfParticipants: participants, hotelLocation }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '결제 처리에 실패했습니다.');
        return;
      }
      setConfirmResult(data);
      setStep('confirmed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '결제 처리에 실패했습니다.');
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
        ? `${schedule[0].places[0].name || '맞춤'} 투어 ${schedule.length}일`
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
          hotel_location: hotelLocation,
          hotel_address: hotelInfo?.address ?? null,
          hotel_lat: hotelInfo?.lat ?? null,
          hotel_lng: hotelInfo?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '제안에 실패했습니다.');
      setProposedDone(true);
      router.push('/custom-join-tour/proposed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '제안에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getMinTourDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  };

  const minDateForPicker = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  /** Format time "HH:mm" for display with localized AM/PM (e.g. "오전 09:00", "09:00 AM"). */
  const formatTimeDisplay = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr ?? '0', 10);
    const m = parseInt(mStr ?? '0', 10);
    const isAM = h < 12;
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = isAM ? (t('home.customJoinTour.timeAM') || 'AM') : (t('home.customJoinTour.timePM') || 'PM');
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${ampm} ${pad(displayH)}:${pad(m)}`;
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
    const newErrors: CheckoutErrorsState = {};
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
      let proposedTourIdForBooking: string | null = joinProposedId;
      if (!joinProposedId) {
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
            hotel_location: hotelLocation,
            hotel_address: hotelInfo?.address ?? null,
            hotel_lat: hotelInfo?.lat ?? null,
            hotel_lng: hotelInfo?.lng ?? null,
          }),
        });
        const proposeData = await proposeRes.json();
        if (!proposeRes.ok) {
          setError(proposeData.error || 'Failed to save tour proposal.');
          return;
        }
        proposedTourIdForBooking = proposeData.id ?? null;
        setProposedDone(true);
      }

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
        specialRequests: JSON.stringify({
          proposedTourId: proposedTourIdForBooking,
          joinProposedId: joinProposedId ?? undefined,
          schedule,
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

  return (
    <>
      <div className="custom-join-premium tour-planner-page w-full min-h-[calc(100dvh-5rem)] pb-8 text-slate-900 antialiased">
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-3xl lg:max-w-5xl">
        {showDashboard && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr,minmax(260px,300px)] gap-6 lg:gap-8">
          <div className="flex flex-col gap-6 min-w-0">
            {/* Join mode: select hotel and check distance before proceeding to checkout */}
            {proposedTourToJoin && !joinProposedId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[1.5rem] border border-white/50 bg-white/60 p-6 shadow-[0_22px_48px_-14px_rgba(15,23,42,0.12)] ring-1 ring-white/70 backdrop-blur-xl"
              >
                <div className="flex items-center justify-between mb-4">
                  <Link href="/custom-join-tour/proposed" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    ← {t('home.customJoinTour.backToProposed')}
                  </Link>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">{proposedTourToJoin.title}</h3>
                <p className="text-sm font-semibold text-blue-800 mb-4">
                  {formatPrice(proposedTourToJoin.total_price_krw)} · {proposedTourToJoin.participants}명
                </p>
                <label className="mb-2 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.hotelLocationLabel')}</label>
                <button
                  type="button"
                  onClick={() => setHotelMapOpen(true)}
                  className={`mb-3 w-full truncate px-3 py-2.5 text-left text-sm text-slate-800 ${PREMIUM_GLASS_SURFACE}`}
                >
                  {hotelInfo ? (hotelInfo.placeName ?? hotelInfo.address) : t('home.customJoinTour.hotelInformationPlaceholder')}
                </button>
                {joinDistanceError && <p className="text-sm text-rose-400 mb-3">{joinDistanceError}</p>}
                <button
                  type="button"
                  onClick={proceedToJoinTour}
                  disabled={!hotelInfo || !!joinDistanceError}
                  className="w-full py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {t('home.customJoinTour.proceedToJoin')}
                </button>
              </motion.div>
            )}
            {/* Tour Design Form (hidden when in join mode until proceed) */}
            {(!proposedTourToJoin || joinProposedId) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="h-fit"
            >
              <div className="px-6 lg:px-8 pt-6 lg:pt-8">
              {isPropose && !joinProposedId && (
                <div className="mb-4">
                  <Link href="/custom-join-tour/proposed" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                    ← {t('home.customJoinTour.backToProposed')}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="rounded-lg border border-blue-200/80 bg-blue-50/90 p-2 shadow-sm"
                >
                  <AiInputSparkleIcon className="h-6 w-6 text-blue-600" />
                </motion.div>
                <h2 className="text-lg font-bold tracking-tight text-slate-900">
                  {t('home.customJoinTour.pageTitle')}
                </h2>
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.destinationLabel')}</label>
              <div className="mb-5 max-w-md">
                <CustomSelect
                  variant="premium"
                  value={destination ?? 'jeju'}
                  onChange={(v) => setDestination((v as 'jeju' | 'busan' | 'seoul') || null)}
                  options={[
                    { value: 'jeju', label: 'Jeju Island' },
                    { value: 'busan', label: 'Busan' },
                    { value: 'seoul', label: 'Seoul' },
                  ]}
                />
              </div>
              </div>

              <div className="px-6 lg:px-8 pb-6 lg:pb-8 pt-2">
              {/* Order: destination → hotel → date/time → guests & vehicle → language → AI → keywords → generate */}
              <label className="mb-2 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.hotelLocationLabel')}</label>
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setHotelMapOpen(true)}
                  className={`w-full truncate px-3 py-2.5 text-left text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/25 ${PREMIUM_GLASS_SURFACE}`}
                >
                  {hotelInfo ? (hotelInfo.placeName ?? hotelInfo.address) : t('home.customJoinTour.hotelInformationPlaceholder')}
                </button>
                {hotelInfo && (
                  <p className="mt-2 text-xs text-slate-600">
                    {copy.pickupMatch.good}
                    {hotelLocation !== 'jeju_city' && (
                      <span className="ml-1.5 text-amber-700">· {copy.surcharge.short}</span>
                    )}
                  </p>
                )}
              </div>
              <HotelMapPicker
                open={hotelMapOpen}
                onClose={() => setHotelMapOpen(false)}
                onConfirm={(info) => { setHotelInfo(info); setHotelMapOpen(false); }}
              />

              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="space-y-1">
                  <label className="mb-1 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.tourDateLabel')}</label>
                  <CustomCalendar
                    variant="premium"
                    value={tourDate}
                    onChange={setTourDate}
                    min={minDateForPicker ? minDateForPicker.toISOString().slice(0, 10) : undefined}
                    placeholder={t('home.customJoinTour.datePlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="mb-1 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.departureTime')}</label>
                  <CustomTimePicker
                    variant="premium"
                    value={departureTime}
                    onChange={setDepartureTime}
                    placeholder={t('home.customJoinTour.timePlaceholder') || '09:00 AM'}
                    formatDisplay={formatTimeDisplay}
                  />
                </div>
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.guestsAndVehicleLabel')}</label>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <CustomSelect
                  variant="premium"
                  value={String(participants)}
                  onChange={(v) => setParticipants(Number(v))}
                  options={Array.from(
                    { length: CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS - CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS + 1 },
                    (_, i) => ({ value: String(CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS + i), label: String(CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS + i) })
                  )}
                  align="left"
                />
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.guideLanguage')}</label>
              <div className="mb-5">
                <CustomSelect
                  variant="premium"
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: 'ko', label: `🇰🇷 ${t('home.customJoinTour.guideKorean')}` },
                    { value: 'en', label: `🇺🇸 ${t('home.customJoinTour.guideEnglish')}` },
                    { value: 'zh', label: `🇨🇳 ${t('home.customJoinTour.guideChinese')}` },
                    { value: 'ja', label: `🇯🇵 ${t('home.customJoinTour.guideJapanese')}` },
                  ]}
                />
              </div>

              <label className="mb-2 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.describeLabel')}</label>
              <div className="relative mb-3">
                <textarea
                  rows={4}
                  value={customerInput}
                  onChange={(e) => setCustomerInput(e.target.value)}
                  placeholder={t('home.customJoinTour.describePlaceholder')}
                  className={PREMIUM_GLASS_TEXTAREA_CLASS}
                />
                <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 text-[10px] text-blue-600/90">
                  <AiInputSparkleIcon className="h-3 w-3 shrink-0 text-blue-600" aria-hidden />
                  <span>AI Powered</span>
                </span>
              </div>
              <p className="mb-5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-blue-700/90">
                {[
                  { labelKey: 'themeTagUnesco' },
                  { labelKey: 'themeTagSunrise' },
                  { labelKey: 'themeTagKdrama' },
                  { labelKey: 'themeTagFood' },
                  { labelKey: 'themeTagNature' },
                ].map(({ labelKey }) => {
                  const label = t(`home.customJoinTour.${labelKey}`);
                  const tag = `#${label}`;
                  return (
                    <button
                      key={labelKey}
                      type="button"
                      onClick={() => setCustomerInput((prev) => (prev.trim() ? `${prev.trim()} ${tag}` : tag))}
                      className="transition-colors hover:text-blue-900"
                    >
                      {tag}
                    </button>
                  );
                })}
              </p>

              {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
              <div className="mb-4 rounded-xl border border-slate-200/90 bg-slate-50/90 px-4 py-3.5 shadow-sm">
                <p className="text-sm font-semibold leading-snug text-slate-900">
                  {t('home.customJoinTour.departureGuaranteeTitle')}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">
                  <GuaranteeBodyWithBold text={t('home.customJoinTour.departureGuaranteeBody')} /> {t('home.customJoinTour.departureGuaranteeMinPax')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !hotelInfo}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <AiInputSparkleIcon className="h-4 w-4 text-white" />}
                {t('home.customJoinTour.generateButton')}
              </button>
              </div>
            </motion.div>
            )}

          </div>
          {/* Live summary panel (desktop): sticky right, existing state only */}
          {(!proposedTourToJoin || joinProposedId) && (
            <aside className="sticky top-24 hidden self-start lg:block">
              <div className={`p-4 ${PREMIUM_GLASS_SURFACE}`}>
                <p className="mb-3 text-sm font-bold text-slate-900">Summary</p>
                <ul className="space-y-1.5 text-sm text-slate-800">
                  <li><span className="font-medium text-slate-600">Destination</span> {destination === 'busan' ? 'Busan' : destination === 'seoul' ? 'Seoul' : 'Jeju'}</li>
                  <li><span className="font-medium text-slate-600">Hotel area</span> {hotelInfo ? copy.builderPickupArea[hotelLocation] : '—'}</li>
                  <li><span className="font-medium text-slate-600">Date</span> {tourDate || '—'}</li>
                  <li><span className="font-medium text-slate-600">Guests</span> {participants}</li>
                </ul>
                {hotelLocation !== 'jeju_city' && hotelInfo && (
                  <p className="mt-2 text-[11px] text-amber-800">{copy.surcharge.short}</p>
                )}
              </div>
            </aside>
          )}
          </div>
        )}

        {/* Step: Itinerary ??new tab view */}
        {step === 'itinerary' && (
          <motion.div
            ref={itineraryRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-[1.75rem] border border-white/50 bg-white/55 px-4 py-6 shadow-[0_22px_48px_-14px_rgba(15,23,42,0.12)] ring-1 ring-white/60 backdrop-blur-xl sm:px-5 lg:px-6 lg:py-8"
          >
            <div className="absolute left-0 top-0 h-0.5 w-full bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-80" />
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.35 }} className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-blue-800">
                <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                {t('home.customJoinTour.itineraryTitle')}
              </h3>
            </motion.div>
            {guideMessage && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }} className="mb-3 rounded-xl border border-blue-100 bg-blue-50/90 px-4 py-3 text-xs text-slate-700">
                {locale === 'ko'
                  ? guideMessage
                  : (guideMessage === '검증된 일정입니다. 즐거운 여행 되세요.' || guideMessage === '일정을 확인해 주세요.')
                    ? (locale === 'ja' ? t('home.customJoinTour.verifySuccessJa') : locale === 'zh' ? t('home.customJoinTour.verifySuccessZh') : locale === 'zh-TW' ? t('home.customJoinTour.verifySuccessZhTw') : locale === 'es' ? t('home.customJoinTour.verifySuccessEs') : t('home.customJoinTour.verifySuccessEn'))
                    : guideMessage}
              </motion.div>
            )}
            {extraFeeNotice && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19, duration: 0.35 }} className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">{extraFeeNotice}</motion.div>}
            {pricing && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.35 }} className="mb-4 rounded-xl border border-slate-200/90 bg-white/80 px-4 py-3 text-xs text-slate-700">
                {locale === 'ko' ? pricing.vehicleLabelKo : (pricing.vehicleLabelKo === CUSTOM_JOIN_TOUR.VAN.LABEL_KO ? t('home.customJoinTour.vehicleVan') : t('home.customJoinTour.vehicleLargeVan'))} · {t('home.customJoinTour.vehicleTotalSummary').replace('{{n}}', String(participants)).replace('{{price}}', formatPrice(pricing.totalPriceKrw))}
              </motion.div>
            )}
            <div className="relative space-y-6">
              <div className="absolute bottom-2 left-2 top-2 w-[2px] rounded-full bg-slate-200" />
              {schedule.map((daySchedule, dayIndex) => (
                <motion.div
                  key={daySchedule.day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.33 + dayIndex * 0.15, duration: 0.45, ease: 'easeOut' }}
                  className="relative"
                >
                  <div className="mb-3 flex items-center gap-2 pl-6 sm:pl-7">
                    <span className="rounded border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-800">{t('home.customJoinTour.dayLabel').replace('{{n}}', String(daySchedule.day))}</span>
                    {dailyDistancesKm[dayIndex] != null && <span className="text-[11px] text-slate-500">{locale === 'ko' ? '이동 거리' : 'Distance'}: {dailyDistancesKm[dayIndex]} km</span>}
                  </div>
                  <ul className="space-y-4">
                    <AnimatePresence initial={false}>
                    {daySchedule.places.map((place, placeIndex) => (
                      <motion.li
                        key={(place as { _uid?: string })._uid ?? `day-${dayIndex}-${placeIndex}`}
                        layoutId={(place as { _uid?: string })._uid ?? `day-${dayIndex}-${placeIndex}`}
                        layout
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                        transition={{ layout: { type: 'spring', stiffness: 400, damping: 35 }, opacity: { duration: 0.3 }, x: { duration: 0.3 } }}
                        className="relative pl-6 sm:pl-7"
                      >
                        <div className="absolute left-0 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500 bg-white shadow-sm">
                          <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        </div>
                        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:border-blue-200">
                          {(place as { image_url?: string | null }).image_url ? (
                            <div className="relative aspect-[16/9] w-full max-h-[10rem] min-h-[5.5rem] bg-slate-100">
                              <Image
                                src={(place as { image_url: string }).image_url}
                                alt={place.name ? place.name : t('home.customJoinTour.placeName')}
                                fill
                                sizes="(max-width: 1024px) 100vw, 720px"
                                className="object-cover"
                              />
                            </div>
                          ) : null}
                          <div className="px-2 py-2 sm:px-2.5 sm:py-2.5">
                          <div className="flex gap-2 items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input type="text" value={place.name} onChange={(e) => updatePlace(dayIndex, placeIndex, 'name', e.target.value)} placeholder={t('home.customJoinTour.placeName')} className="min-w-0 w-full border-none bg-transparent px-0 py-0.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-0" />
                                {(place as { type?: string }).type === 'restaurant' && (
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                                    <UtensilsCrossed size={10} />
                                    <span>{t('home.customJoinTour.restaurant')}</span>
                                  </span>
                                )}
                              </div>
                              <input type="text" value={place.address} onChange={(e) => updatePlace(dayIndex, placeIndex, 'address', e.target.value)} placeholder={t('home.customJoinTour.address')} className="mt-1 w-full border-none bg-transparent px-0 py-0 text-xs text-slate-600 placeholder:text-slate-400 outline-none focus:ring-0" />
                              <div className="mt-2 min-h-[2.5rem]">
                                {(place as { overview?: string | null }).overview ? (
                                  <p className="line-clamp-[7] text-sm leading-snug text-slate-700 sm:line-clamp-[8]">{(place as { overview: string }).overview}</p>
                                ) : (
                                  <p className="text-sm italic text-slate-400">{t('home.customJoinTour.placeDescriptionPlaceholder') || 'Brief description will appear here.'}</p>
                                )}
                              </div>
                              {((place as { open_time?: string | null }).open_time || (place as { use_fee?: string | null }).use_fee || (place as { tel?: string | null }).tel || ((place as { mapy?: number | null }).mapy != null && (place as { mapx?: number | null }).mapx != null)) && (
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                  {(place as { open_time?: string | null }).open_time && (
                                    <span><span className="font-medium text-blue-700">{t('home.customJoinTour.openTime')}</span> {(place as { open_time: string }).open_time}</span>
                                  )}
                                  {(place as { use_fee?: string | null }).use_fee && (
                                    <span><span className="font-medium text-blue-700">{t('home.customJoinTour.useFee')}</span> {(place as { use_fee: string }).use_fee}</span>
                                  )}
                                  {(place as { tel?: string | null }).tel && (
                                    <span><span className="font-medium text-blue-700">{t('home.customJoinTour.tel')}</span> {(place as { tel: string }).tel}</span>
                                  )}
                                  {((place as { mapy?: number | null }).mapy != null && (place as { mapx?: number | null }).mapx != null) && (
                                    <span><span className="font-medium text-blue-700">{t('home.customJoinTour.coordinates')}</span> {(place as { mapy: number }).mapy}, {(place as { mapx: number }).mapx}</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button type="button" onClick={() => movePlace(dayIndex, placeIndex, 'up')} disabled={placeIndex === 0} className="rounded p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30" aria-label={t('home.customJoinTour.moveUp')}><ChevronUp className="w-4 h-4" /></button>
                              <button type="button" onClick={() => movePlace(dayIndex, placeIndex, 'down')} disabled={placeIndex === daySchedule.places.length - 1} className="rounded p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30" aria-label={t('home.customJoinTour.moveDown')}><ChevronDown className="w-4 h-4" /></button>
                              <button type="button" onClick={() => removePlace(dayIndex, placeIndex)} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label={t('home.customJoinTour.removePlace')}><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                    </AnimatePresence>
                  </ul>
                  <button type="button" onClick={() => addPlace(dayIndex)} className="ml-6 mt-3 flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 sm:ml-7"><Plus className="w-3.5 h-3.5" /> {t('home.customJoinTour.addPlace')}</button>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.33 + schedule.length * 0.15, duration: 0.35 }}
              className="mt-6 rounded-[1.35rem] border border-slate-700/35 bg-slate-900/45 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.07),0_18px_40px_-18px_rgba(15,23,42,0.45)] ring-1 ring-white/10 backdrop-blur-xl sm:p-4"
            >
              <ItineraryMapWithSearch schedule={schedule} onAddPlace={addPlaceFromSearch} destination={destination ?? 'jeju'} />
            </motion.div>
            {error && <p className="text-xs text-rose-400 mt-3">{error}</p>}
            <motion.button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + schedule.length * 0.15, duration: 0.35 }}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-4 w-4" />}
              {loading ? '로딩 중...' : t('home.customJoinTour.confirmItinerary')}
            </motion.button>
          </motion.div>
        )}

        {/* Step: Checkout */}
        {step === 'checkout' && confirmResult && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            ref={itineraryRef}
            className="space-y-5"
          >
                {/* booking info */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
              <h3 className="mb-1.5 text-sm font-bold text-amber-900">{t('home.customJoinTour.noticeTitle')}</h3>
              <ul className="list-inside list-disc space-y-1 text-xs text-amber-900/90">
                <li>{t('home.customJoinTour.notice24hCancel')}</li>
                <li>{t('home.customJoinTour.notice48hProposal')}</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {/* customer info */}
              <div className="md:col-span-2">
                <div className="rounded-[1.5rem] border border-white/50 bg-white/60 p-5 shadow-[0_22px_48px_-14px_rgba(15,23,42,0.12)] ring-1 ring-white/70 backdrop-blur-xl sm:p-6">
                  <h2 className="mb-4 text-base font-bold text-slate-900">{t('booking.customerInfo')}</h2>
                  <div className="space-y-4">
                    {[
                      { label: t('booking.fullName'), key: 'name' as const, type: 'text', placeholder: t('booking.enterFullName') },
                      { label: t('booking.phone'), key: 'phone' as const, type: 'tel', placeholder: t('booking.enterPhone') },
                      { label: t('booking.email'), key: 'email' as const, type: 'email', placeholder: t('booking.enterEmail') },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">{label} <span className="text-red-500">*</span></label>
                        <input
                          type={type}
                          value={customerInfo[key]}
                          onChange={(e) => {
                            const v = key === 'phone' ? e.target.value.replace(/[^0-9+]/g, '') : e.target.value;
                            setCustomerInfo((c) => ({ ...c, [key]: v }));
                            setCheckoutErrors((err) => ({ ...err, [key]: undefined }));
                          }}
                          className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${checkoutErrors[key] ? 'border-red-400' : ''}`}
                          placeholder={placeholder}
                        />
                        {checkoutErrors[key] && <p className="mt-1 text-xs text-red-400">{checkoutErrors[key]}</p>}
                      </div>
                    ))}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">{t('tour.preferredChatApp')} <span className="text-red-500">*</span></label>
                      <select
                        value={customerInfo.preferredChatApp}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, preferredChatApp: e.target.value })); setCheckoutErrors((err) => ({ ...err, preferredChatApp: undefined })); }}
                        className={`w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${checkoutErrors.preferredChatApp ? 'border-red-400' : ''}`}
                      >
                        <option value="">{t('tour.pleaseSelect')}</option>
                        <option value="kakao">KakaoTalk</option>
                        <option value="line">LINE</option>
                        <option value="wechat">WeChat</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="telegram">Telegram</option>
                        <option value="other">Other</option>
                      </select>
                      <p className="mt-1 text-[11px] text-gray-400 leading-snug">
                        LINE 등 일부 메신저는 국가가 다르면 ID·전화번호 검색이 제한될 수 있어요. 가능하면
                        {' '}<span className="font-semibold">채팅 초대 링크</span>를 남겨 주시거나,
                        {' '}<span className="font-semibold">가이드가 보내는 이메일 안내</span>를 꼭 확인해 주세요.
                      </p>
                      {checkoutErrors.preferredChatApp && <p className="mt-1 text-xs text-red-400">{checkoutErrors.preferredChatApp}</p>}
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">{t('tour.chatAppContact')} <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={customerInfo.chatAppContact}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, chatAppContact: e.target.value })); setCheckoutErrors((err) => ({ ...err, chatAppContact: undefined })); }}
                        className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${checkoutErrors.chatAppContact ? 'border-red-400' : ''}`}
                        placeholder={customerInfo.preferredChatApp === 'line' ? t('tour.enterLineLink') : t('tour.enterChatAppId')}
                      />
                      {checkoutErrors.chatAppContact && <p className="mt-1 text-xs text-red-400">{checkoutErrors.chatAppContact}</p>}
                    </div>
                  </div>
                </div>
              </div>

                {/* payment info */}
              <div>
                <div className="sticky top-24 rounded-[1.5rem] border border-white/50 bg-white/60 p-5 shadow-[0_22px_48px_-14px_rgba(15,23,42,0.12)] ring-1 ring-white/70 backdrop-blur-xl">
                  <h2 className="mb-4 text-base font-bold text-slate-900">{t('booking.bookingSummary')}</h2>
                  <div className="mb-4 space-y-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-900">{t('booking.tourDate')}</label>
                      <input
                        type="date"
                        min={getMinTourDate()}
                        value={tourDate}
                        onChange={(e) => setTourDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-900">{t('home.customJoinTour.departureTime')}</label>
                      <input
                        type="time"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-slate-200/80 pt-3 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>{t('booking.tourDate')}</span>
                      <span className="font-medium text-slate-900">{tourDate || '-'} {departureTime}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>{t('tour.guests')}</span>
                      <span className="font-medium text-slate-900">{participants}</span>
                    </div>
                    {confirmResult.pricing && (
                      <div className="flex justify-between border-t border-slate-200/80 pt-2">
                        <span className="text-slate-500">{t('tour.total')}</span>
                        <span className="text-base font-bold text-blue-700">{formatPrice(confirmResult.pricing.totalPriceKrw)}</span>
                      </div>
                    )}
                  </div>
                  {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    disabled={loading}
                    className="mt-4 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('home.customJoinTour.proceedToPayment')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step: Confirmed */}
        {step === 'confirmed' && confirmResult && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="space-y-4 rounded-[1.75rem] border border-white/50 bg-white/55 p-5 shadow-[0_22px_48px_-14px_rgba(15,23,42,0.12)] ring-1 ring-white/60 backdrop-blur-xl sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
              className="pt-2 text-center"
            >
              <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 shadow-sm">
                <Check className="h-7 w-7 text-blue-600" />
              </div>
              <h2 className="mb-1 text-base font-bold text-slate-900">
                {t('home.customJoinTour.confirmSuccess')}
              </h2>
              <p className="text-xs text-slate-600">{t('home.customJoinTour.confirmSuccessDesc')}</p>
            </motion.div>

            {confirmResult.pricing && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="rounded-xl border border-slate-200/90 bg-white/80 px-4 py-3 text-xs text-slate-700"
              >
                {locale === 'ko' ? confirmResult.pricing.vehicleLabelKo : (confirmResult.pricing.vehicleLabelKo === CUSTOM_JOIN_TOUR.VAN.LABEL_KO ? t('home.customJoinTour.vehicleVan') : t('home.customJoinTour.vehicleLargeVan'))} · {formatPrice(confirmResult.pricing.totalPriceKrw)}
              </motion.div>
            )}

            {/* document link */}
            {confirmResult.jejuCrossRegion && confirmResult.jejuCrossRegionNotice && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.35 }}
                className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3"
              >
                <p className="mb-1 text-xs font-semibold text-amber-900">{t('home.customJoinTour.jejuCrossRegionTitle')}</p>
                <p className="text-[11px] text-amber-900/85">{confirmResult.jejuCrossRegionNotice}</p>
                {confirmResult.jejuCrossRegionExtraFeeKrw != null && (
                  <p className="mt-2 text-[11px] font-medium text-amber-900">
                    {t('home.customJoinTour.jejuCrossRegionExtraFee', { amount: locale === 'ko' ? (confirmResult.jejuCrossRegionExtraFeeKrw / 10000).toFixed(0) : formatPrice(confirmResult.jejuCrossRegionExtraFeeKrw) })}
                  </p>
                )}
              </motion.div>
            )}

            {/* CTA button */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
              className="space-y-3 pt-1"
            >
              {!proposedDone ? (
                <button
                  type="button"
                  onClick={() => setStep('checkout')}
                  className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-blue-700"
                >
                  {t('home.customJoinTour.proposeThisTour')}
                </button>
              ) : (
                <p className="py-2 text-center text-xs font-medium text-emerald-700">{t('home.customJoinTour.proposedDone')}</p>
              )}
              <Link
                href="/custom-join-tour/proposed"
                className="block w-full rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200 hover:bg-slate-50"
              >
                {t('home.proposedTours.viewAll')}
              </Link>
              <Link
                href="/tours"
                className="block w-full rounded-xl py-2 text-center text-xs text-slate-500 transition-colors hover:text-slate-800"
              >
                {t('home.customJoinTour.viewFixedTours')}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </main>
      </div>
      <BuilderLoadingOverlay
        visible={showGenerateOverlay}
        areaLabel={hotelInfo ? (copy.builderPickupArea[hotelLocation] ?? null) : null}
        success={generateSuccess}
      />
    </>
  );
}
