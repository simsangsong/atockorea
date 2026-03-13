'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import { useTranslations, useI18n } from '@/lib/i18n';
import { useCurrencyOptional } from '@/lib/currency';
import { Loader2, Plus, Trash2, Check, ChevronUp, ChevronDown, Calendar, Clock, Bot, UtensilsCrossed } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RobotMascot } from '@/components/RobotMascot';
import CustomCalendar from '@/components/CustomCalendar';
import { CustomTimePicker, CustomSelect } from '@/components/CustomPicker';
import dynamic from 'next/dynamic';

const ItineraryMapWithSearch = dynamic(
  () => import('@/components/maps/ItineraryMapWithSearch').then((m) => m.default),
  { ssr: false, loading: () => <div className="w-full h-64 rounded-2xl bg-neutral-100 animate-pulse" /> }
);
import type { DaySchedule } from '@/app/api/custom-join-tour/generate/route';
import { CUSTOM_JOIN_TOUR, getCustomJoinTourBookingTourId } from '@/lib/constants/custom-join-tour';
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

/** 중요 구절??볼드�?감싸???�더 (48 hours, 24 hours, cancelled and fully refunded ?? */
function GuaranteeBodyWithBold({ text }: { text: string }) {
  const phrases = ['48 hours', '24 hours', 'cancelled and fully refunded', '48?�간', '24?�간', '취소?�며 ?�액 ?�불', '?�액 ?�불'];
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

/** Tour theme keywords ??cyber-tag color variant per label (visual only) */
const TOUR_THEME_KEYWORDS: Array<{ label: string; cyberColor: 'yellow' | 'orange' | 'pink' | 'green' | 'teal' }> = [
  { label: 'UNESCO Heritage', cyberColor: 'yellow' },
  { label: 'Sunrise & Sunset', cyberColor: 'orange' },
  { label: 'K-Drama Locations', cyberColor: 'pink' },
  { label: 'Local Food & Cafes', cyberColor: 'green' },
  { label: 'Nature & Healing', cyberColor: 'teal' },
];

/** ?�이버펑??HUD ?��???�??�이�?(측면, 창문·?�드?�이?�·바???? */
function VanIconWireframe({ active, large }: { active: boolean; large?: boolean }) {
  const s = active ? '#00f0ff' : '#7a8fa6';
  const sf = active ? 'rgba(0,240,255,0.07)' : 'rgba(255,255,255,0.04)';
  const sw = active ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.08)';
  const sd = active ? 'rgba(0,240,255,0.35)' : 'rgba(255,255,255,0.18)';

  if (!large) {
    // Staria: slanted nose, high roof, short hood ??diagonal windshield
    // Body outline: left side rises steeply, roof is flat-high, rear is square
    // viewBox 0 0 76 46
    return (
      <g fill="none" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* main body silhouette ??slanted front nose */}
        <path
          d="M4 38 L4 28 Q4 24 7 22 L16 10 Q19 6 24 6 L66 6 Q70 6 70 10 L70 38 Z"
          fill={sf}
        />
        {/* windshield ??diagonal slant (front A-pillar) */}
        <path
          d="M7 22 L16 10 Q19 6 24 6 L24 18 L10 18 Z"
          fill={sw}
        />
        {/* side windows ??3 windows behind A-pillar */}
        <rect x="26" y="8" width="12" height="9" rx="1.5" fill={sw} />
        <rect x="40" y="8" width="12" height="9" rx="1.5" fill={sw} />
        <rect x="54" y="8" width="12" height="9" rx="1.5" fill={sw} />
        {/* door dividers */}
        <line x1="38" y1="6" x2="38" y2="38" strokeWidth="1" stroke={sd} />
        <line x1="52" y1="6" x2="52" y2="38" strokeWidth="1" stroke={sd} />
        {/* body crease */}
        <line x1="10" y1="27" x2="70" y2="27" strokeWidth="0.7" stroke={sd} />
        {/* headlight ??on slanted nose */}
        <path d="M5 28 L9 22" strokeWidth="2.5" stroke={s} opacity="0.85" strokeLinecap="round" />
        {/* taillight */}
        <rect x="66" y="20" width="3.5" height="6" rx="1" fill={s} opacity="0.8" />
        {/* front bumper */}
        <path d="M4 34 Q5 38 10 38" strokeWidth="1.2" stroke={s} opacity="0.5" />
        {/* rear bumper */}
        <line x1="62" y1="36" x2="70" y2="36" strokeWidth="1.2" stroke={s} opacity="0.5" />
        {/* front wheel */}
        <circle cx="18" cy="38" r="6.5" fill="#0a0f1e" />
        <circle cx="18" cy="38" r="6.5" />
        <circle cx="18" cy="38" r="3.2" strokeWidth="1" />
        <circle cx="18" cy="38" r="1.1" fill={s} stroke="none" />
        {/* rear wheel */}
        <circle cx="56" cy="38" r="6.5" fill="#0a0f1e" />
        <circle cx="56" cy="38" r="6.5" />
        <circle cx="56" cy="38" r="3.2" strokeWidth="1" />
        <circle cx="56" cy="38" r="1.1" fill={s} stroke="none" />
      </g>
    );
  }

  // Solati (Hyundai H350): slanted windshield, short hood, long high-roof body
  // viewBox 0 0 90 50
  return (
    <g fill="none" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* main body ??long van with slanted front */}
      <path
        d="M4 42 L4 30 Q4 26 7 23 L14 12 Q17 8 22 8 L80 8 Q84 8 84 12 L84 42 Z"
        fill={sf}
      />
      {/* windshield ??diagonal slant */}
      <path
        d="M7 23 L14 12 Q17 8 22 8 L22 22 L9 22 Z"
        fill={sw}
      />
      {/* side windows ??4 windows */}
      <rect x="24" y="10" width="13" height="10" rx="1.5" fill={sw} />
      <rect x="39" y="10" width="13" height="10" rx="1.5" fill={sw} />
      <rect x="54" y="10" width="13" height="10" rx="1.5" fill={sw} />
      <rect x="69" y="10" width="11" height="10" rx="1.5" fill={sw} />
      {/* door dividers */}
      <line x1="37" y1="8" x2="37" y2="42" strokeWidth="1" stroke={sd} />
      <line x1="67" y1="8" x2="67" y2="42" strokeWidth="1" stroke={sd} />
      {/* body crease */}
      <line x1="9" y1="31" x2="84" y2="31" strokeWidth="0.7" stroke={sd} />
      {/* headlight ??on slanted nose */}
      <path d="M5 30 L9 23" strokeWidth="2.5" stroke={s} opacity="0.85" strokeLinecap="round" />
      {/* taillight */}
      <rect x="80" y="22" width="3.5" height="7" rx="1" fill={s} opacity="0.8" />
      {/* front bumper */}
      <path d="M4 38 Q5 42 10 42" strokeWidth="1.2" stroke={s} opacity="0.5" />
      {/* rear bumper */}
      <line x1="70" y1="40" x2="84" y2="40" strokeWidth="1.2" stroke={s} opacity="0.5" />
      {/* front wheel */}
      <circle cx="20" cy="42" r="7.5" fill="#0a0f1e" />
      <circle cx="20" cy="42" r="7.5" />
      <circle cx="20" cy="42" r="3.8" strokeWidth="1" />
      <circle cx="20" cy="42" r="1.3" fill={s} stroke="none" />
      {/* rear wheel */}
      <circle cx="68" cy="42" r="7.5" fill="#0a0f1e" />
      <circle cx="68" cy="42" r="7.5" />
      <circle cx="68" cy="42" r="3.8" strokeWidth="1" />
      <circle cx="68" cy="42" r="1.3" fill={s} stroke="none" />
    </g>
  );
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

/** Format price in KRW for display: numeric (no "�?). Uses currency context for USD when selected. */
function usePriceFormat() {
  const currency = useCurrencyOptional();
  const { locale } = useI18n();
  return (priceKRW: number) => {
    if (currency?.formatPrice) return currency.formatPrice(priceKRW);
    return new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(priceKRW);
  };
}

export default function CustomJoinTourPage() {
  const t = useTranslations();
  const { locale } = useI18n();
  const formatPrice = usePriceFormat();
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
  const [showGenerateOverlay, setShowGenerateOverlay] = useState(false);
  const generateOverlayPlayedSound = useRef(false);

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
  /** ?�택???�마 ?�워??(?��???배열) */
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

  /** ??창에???�었????localStorage?�서 ?�정 복원 */
  useEffect(() => {
    if (searchParams.get('open') !== 'itinerary') return;
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
      return;
    }
    if (participants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS || participants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS) {
      setError(t('home.customJoinTour.errorParticipantsRange') || `Please enter ${CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS}??{CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS} guests.`);
      return;
    }
    if (!tourDate) {
      setError(t('home.customJoinTour.errorSelectDate') || 'Please select a tour date.');
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
          ...(tourDate ? { tourStartDate: tourDate } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '?�정 ?�성???�패?�습?�다.');
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
        ? ` (?�영 규칙?�로 ?�외???�소: ${(data.removedPlaces as Array<{ name: string; reason: string }>).map((r) => `${r.name}`).join(', ')})`
        : '';
      setGuideMessage((data.guideMessage || '') + removedNotice);
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
        setTimeout(() => {
          router.push(`${window.location.pathname}?open=itinerary`);
          setShowGenerateOverlay(false);
        }, 1800);
      } catch {
        setShowGenerateOverlay(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '?�정 ?�성???�패?�습?�다.');
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
        body: JSON.stringify({ schedule, numberOfParticipants: participants }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '?�정 처리???�패?�습?�다.');
        return;
      }
      setConfirmResult(data);
      setStep('confirmed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '?�정 처리???�패?�습?�다.');
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '발의???�패?�습?�다.');
      setProposedDone(true);
      router.push('/custom-join-tour/proposed');
    } catch (e) {
      setError(e instanceof Error ? e.message : '발의???�패?�습?�다.');
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

  /** Format time "HH:mm" for display with localized AM/PM (e.g. "?�전 09:00", "09:00 AM"). */
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
  const isDarkTheme = true;

  const fieldClass = 'w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 outline-none appearance-none cursor-pointer transition-colors';
  const labelClass = 'block text-[11px] font-bold text-black uppercase tracking-wider mb-1.5 ml-1';

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'tour-planner-page bg-[#0d1a2e] text-white' : 'bg-white text-neutral-900'}`}>
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-3xl">
        {/* Single-column form */}
        {showDashboard && (
          <div className="flex flex-col gap-6">
            {/* Tour Design Form ??glassmorphism */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card tech-scanline h-fit overflow-hidden"
            >
              <div className="px-6 lg:px-8 pt-6 lg:pt-8">
              {isPropose && (
                <div className="mb-4">
                  <Link href="/custom-join-tour/proposed" className="text-xs text-cyan-400 hover:text-cyan-300 font-medium">
                    ??{t('home.customJoinTour.backToProposed')}
                  </Link>
                </div>
              )}
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="p-2 bg-cyan-500/20 rounded-lg border border-cyan-400/50 shadow-[0_0_12px_rgba(0,255,255,0.2)]"
                >
                  <Bot className="text-cyan-400" size={24} />
                </motion.div>
                <h2 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent">
                  {t('home.customJoinTour.pageTitle')}
                </h2>
              </div>

              <label className="text-base font-bold text-cyan-400 uppercase tracking-widest block mb-4">{t('home.customJoinTour.destinationLabel')}</label>
              </div>
              {/* Destination map ??full-width */}
              <div className="tour-map-block w-full relative" style={{
                background: '#0d1a2e',
                backgroundImage: 'linear-gradient(to bottom, transparent 50%, rgba(0, 255, 255, 0.02) 50%)',
                backgroundSize: '100% 4px',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={destination === 'busan' ? '/images/busan-hologram.png' : destination === 'seoul' ? '/images/seoul-hologram.png' : '/images/jeju-hologram.png'}
                  alt={destination === 'busan' ? 'Busan' : destination === 'seoul' ? 'Seoul' : 'Jeju Island'}
                  className="block mx-auto"
                  style={{ display: 'block', boxShadow: 'none', border: 'none', outline: 'none', width: '90%', mixBlendMode: 'screen' }}
                />
                {/* scanline overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: 'linear-gradient(to bottom, transparent 50%, rgba(0, 255, 255, 0.02) 50%)',
                  backgroundSize: '100% 4px',
                }} />
                <div className="flex flex-col items-center gap-1 py-3 px-6 lg:px-8 relative z-[9999]">
                  <p className="text-[#00ffff] text-lg font-bold text-center" style={{ textShadow: '0 0 8px rgba(0,255,255,0.6)' }}>
                    {destination === 'busan' ? 'Busan' : destination === 'seoul' ? 'Seoul' : 'Jeju Island'}
                  </p>
                  <div className="mt-1 w-44">
                    <CustomSelect
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
              </div>

              <div className="px-6 lg:px-8 pb-6 lg:pb-8 pt-4">
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">{t('home.customJoinTour.tourDateLabel')}</label>
                  <CustomCalendar
                    value={tourDate}
                    onChange={setTourDate}
                    min={minDateForPicker ? minDateForPicker.toISOString().slice(0, 10) : undefined}
                    placeholder={t('home.customJoinTour.datePlaceholder')}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider">{t('home.customJoinTour.departureTime')}</label>
                  <CustomTimePicker
                    value={departureTime}
                    onChange={setDepartureTime}
                    placeholder={t('home.customJoinTour.timePlaceholder') || '09:00 AM'}
                    formatDisplay={formatTimeDisplay}
                  />
                </div>
              </div>

              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">{t('home.customJoinTour.guideLanguage')}</label>
              <div className="mb-5">
                <CustomSelect
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: 'ko', label: `?��?�� ${t('home.customJoinTour.guideKorean')}` },
                    { value: 'en', label: `?��?�� ${t('home.customJoinTour.guideEnglish')}` },
                    { value: 'zh', label: `?��?�� ${t('home.customJoinTour.guideChinese')}` },
                    { value: 'ja', label: `?��?�� ${t('home.customJoinTour.guideJapanese')}` },
                  ]}
                />
              </div>

              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">{t('home.customJoinTour.guestsAndVehicleLabel')}</label>
              <div className="flex items-center gap-3 mb-3 w-24">
                <CustomSelect
                  value={String(participants)}
                  onChange={(v) => setParticipants(Number(v))}
                  options={Array.from(
                    { length: CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS - CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS + 1 },
                    (_, i) => ({ value: String(CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS + i), label: String(CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS + i) })
                  )}
                  align="left"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <label className="cursor-pointer">
                  <input type="radio" name="vehicle" className="peer sr-only" checked={participants <= 6} onChange={() => setParticipants((p) => Math.min(6, p))} />
                  <div className={`cyber-vehicle-card ${participants <= 6 ? 'selected' : ''}`}>
                    <svg viewBox="0 0 76 48" className="w-20 h-auto shrink-0" style={{ filter: participants <= 6 ? 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.7))' : 'drop-shadow(0 0 4px rgba(255,255,255,0.2))' }} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <VanIconWireframe active={participants <= 6} />
                    </svg>
                    <div className="text-sm font-bold text-center">{t('home.customJoinTour.vehicleVanLabel')}</div>
                    <div className="text-[10px] opacity-60 text-center">{t('home.customJoinTour.vehicleVanPrice')}</div>
                    {participants <= 6 && (
                      <div className="text-xs font-bold text-cyan-300 text-center mt-0.5">
                        {t('home.customJoinTour.vehicleTotalSummary').replace('{{n}}', String(participants)).replace('{{price}}', `??{(participants * CUSTOM_JOIN_TOUR.VAN.PRICE_PER_PERSON_KRW).toLocaleString()}`)}
                      </div>
                    )}
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="vehicle" className="peer sr-only" checked={participants >= 7} onChange={() => setParticipants((p) => Math.max(7, p))} />
                  <div className={`cyber-vehicle-card ${participants >= 7 ? 'selected' : ''}`}>
                    <svg viewBox="0 0 90 52" className="w-20 h-auto shrink-0" style={{ filter: participants >= 7 ? 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.7))' : 'drop-shadow(0 0 4px rgba(255,255,255,0.2))' }} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <VanIconWireframe active={participants >= 7} large />
                    </svg>
                    <div className="text-sm font-bold text-center">{t('home.customJoinTour.vehicleLargeVanLabel')}</div>
                    <div className="text-[10px] opacity-60 text-center">{t('home.customJoinTour.vehicleLargeVanPrice')}</div>
                    {participants >= 7 && (
                      <div className="text-xs font-bold text-cyan-300 text-center mt-0.5">
                        {t('home.customJoinTour.vehicleTotalSummary').replace('{{n}}', String(participants)).replace('{{price}}', `??{(participants * CUSTOM_JOIN_TOUR.LARGE_VAN.PRICE_PER_PERSON_KRW).toLocaleString()}`)}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">{t('home.customJoinTour.themeLabel')}</label>
              <div className="flex flex-wrap gap-2 mb-5">
                {TOUR_THEME_KEYWORDS.map(({ label, cyberColor }) => (
                  <button key={label} type="button" onClick={() => toggleKeyword(label)} className={`cyber-tag ${cyberColor} ${selectedKeywords.includes(label) ? 'selected' : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">{t('home.customJoinTour.describeLabel')}</label>
              <div className="relative mb-5">
                <textarea rows={4} value={customerInput} onChange={(e) => setCustomerInput(e.target.value)} placeholder={t('home.customJoinTour.describePlaceholder')} className="glass-input w-full min-h-[100px] p-3 text-sm text-white placeholder:text-gray-500 resize-none" />
                <span className="absolute bottom-2 right-2 text-[10px] text-cyan-400/80">AI Powered ??/span>
              </div>

              {error && <p className="text-xs text-rose-400 mb-3">{error}</p>}
              <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
                <strong className="text-gray-300">{t('home.customJoinTour.departureGuaranteeTitle')}</strong> <GuaranteeBodyWithBold text={t('home.customJoinTour.departureGuaranteeBody')} /> {t('home.customJoinTour.departureGuaranteeMinPax')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowGenerateOverlay(true);
                  if (!generateOverlayPlayedSound.current) {
                    generateOverlayPlayedSound.current = true;
                    playGlitchSound();
                  }
                  handleGenerate();
                }}
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-sm bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 hover:shadow-[0_0_20px_rgba(0,255,255,0.2)] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                {t('home.customJoinTour.generateButton')} ??              </button>
              </div>{/* end px-6 lg:px-8 pb-6 lg:pb-8 */}
            </motion.div>

          </div>
        )}

        {/* Step: Itinerary ??new tab view */}
        {step === 'itinerary' && (
          <motion.div
            ref={itineraryRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="glass-card tech-scanline p-6 lg:p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(0,255,255,0.6)]" />
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.35 }} className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                {t('home.customJoinTour.itineraryTitle')}
              </h3>
            </motion.div>
            {guideMessage && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.35 }} className="glass-input px-4 py-3 text-xs text-cyan-100/90 mb-3 border-cyan-500/30">{guideMessage}</motion.div>}
            {extraFeeNotice && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19, duration: 0.35 }} className="px-4 py-3 text-xs text-amber-300 border border-amber-500/40 rounded-lg bg-amber-500/10 mb-3">{extraFeeNotice}</motion.div>}
            {pricing && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.35 }} className="glass-input px-4 py-3 text-xs text-gray-300 mb-4">{pricing.vehicleLabelKo} · {t('home.customJoinTour.vehicleTotalSummary').replace('{{n}}', String(participants)).replace('{{price}}', formatPrice(pricing.totalPriceKrw))}</motion.div>}
            <div className="space-y-6 relative">
              <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-cyan-500/30 rounded-full" />
              {schedule.map((daySchedule, dayIndex) => (
                <motion.div
                  key={daySchedule.day}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.33 + dayIndex * 0.15, duration: 0.45, ease: 'easeOut' }}
                  className="relative"
                >
                  <div className="flex items-center gap-2 mb-3 pl-8">
                    <span className="px-2.5 py-1 rounded border border-cyan-500/50 text-cyan-400 text-xs font-bold">{t('home.customJoinTour.dayLabel').replace('{{n}}', String(daySchedule.day))}</span>
                    {dailyDistancesKm[dayIndex] != null && <span className="text-[11px] text-gray-400">?�동 거리 ??{dailyDistancesKm[dayIndex]} km</span>}
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
                        className="relative pl-8"
                      >
                        <div className="absolute left-0 top-4 w-6 h-6 rounded-full bg-[#0d1a2e] border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_8px_rgba(0,255,255,0.4)] z-10">
                          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                        </div>
                        <div className="glass-input p-3 rounded-lg border-white/10 hover:border-cyan-400/40 transition-colors">
                          <div className="flex gap-3 items-start">
                            {(place as { image_url?: string | null }).image_url && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 shrink-0">
                                <Image src={(place as { image_url: string }).image_url} alt={place.name} width={64} height={64} className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input type="text" value={place.name} onChange={(e) => updatePlace(dayIndex, placeIndex, 'name', e.target.value)} placeholder={t('home.customJoinTour.placeName')} className="w-full min-w-0 bg-transparent border-none px-0 py-0.5 text-sm font-semibold text-white placeholder:text-gray-500 outline-none focus:ring-0" />
                                {(place as { type?: string }).type === 'restaurant' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border border-amber-500/50 text-amber-400 shrink-0"><UtensilsCrossed size={10} /> ?�당</span>
                                )}
                              </div>
                              <input type="text" value={place.address} onChange={(e) => updatePlace(dayIndex, placeIndex, 'address', e.target.value)} placeholder={t('home.customJoinTour.address')} className="w-full mt-1 bg-transparent border-none px-0 py-0 text-xs text-gray-400 placeholder:text-gray-500 outline-none focus:ring-0" />
                              {(place as { overview?: string | null }).overview && <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{(place as { overview: string }).overview}</p>}
                            </div>
                            <div className="flex flex-col gap-0.5 shrink-0">
                              <button type="button" onClick={() => movePlace(dayIndex, placeIndex, 'up')} disabled={placeIndex === 0} className="p-1 text-gray-400 hover:text-cyan-400 rounded disabled:opacity-30" aria-label={t('home.customJoinTour.moveUp')}><ChevronUp className="w-4 h-4" /></button>
                              <button type="button" onClick={() => movePlace(dayIndex, placeIndex, 'down')} disabled={placeIndex === daySchedule.places.length - 1} className="p-1 text-gray-400 hover:text-cyan-400 rounded disabled:opacity-30" aria-label={t('home.customJoinTour.moveDown')}><ChevronDown className="w-4 h-4" /></button>
                              <button type="button" onClick={() => removePlace(dayIndex, placeIndex)} className="p-1 text-gray-400 hover:text-rose-400 rounded" aria-label={t('home.customJoinTour.removePlace')}><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                    </AnimatePresence>
                  </ul>
                  <button type="button" onClick={() => addPlace(dayIndex)} className="mt-3 ml-8 flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"><Plus className="w-3.5 h-3.5" /> {t('home.customJoinTour.addPlace')}</button>
                </motion.div>
              ))}
            </div>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.33 + schedule.length * 0.15, duration: 0.35 }} className="mt-6">
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
              className="mt-4 w-full py-3.5 rounded-xl font-semibold text-sm bg-cyan-500/20 border border-cyan-400 text-cyan-300 hover:bg-cyan-500/30 hover:shadow-[0_0_16px_rgba(0,255,255,0.2)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-4 h-4" />}
              {loading ? '검??중�? : t('home.customJoinTour.confirmItinerary')}
            </motion.button>
          </motion.div>
        )}

        {/* Step: Checkout ???�이�??�크 ?�마 */}
        {step === 'checkout' && confirmResult && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            ref={itineraryRef}
            className="space-y-5"
          >
            {/* ?�내 배너 */}
            <div className="rounded-xl bg-amber-500/10 border border-amber-400/40 p-4">
              <h3 className="text-sm font-bold text-amber-300 mb-1.5">{t('home.customJoinTour.noticeTitle')}</h3>
              <ul className="text-xs text-amber-200/80 space-y-1 list-disc list-inside">
                <li>{t('home.customJoinTour.notice24hCancel')}</li>
                <li>{t('home.customJoinTour.notice48hProposal')}</li>
              </ul>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {/* 고객 ?�보 */}
              <div className="md:col-span-2">
                <div className="glass-card p-5 sm:p-6">
                  <h2 className="text-base font-bold bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent mb-4">{t('booking.customerInfo')}</h2>
                  <div className="space-y-4">
                    {[
                      { label: t('booking.fullName'), key: 'name' as const, type: 'text', placeholder: t('booking.enterFullName') },
                      { label: t('booking.phone'), key: 'phone' as const, type: 'tel', placeholder: t('booking.enterPhone') },
                      { label: t('booking.email'), key: 'email' as const, type: 'email', placeholder: t('booking.enterEmail') },
                    ].map(({ label, key, type, placeholder }) => (
                      <div key={key}>
                        <label className="block text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-1.5">{label} <span className="text-red-400">*</span></label>
                        <input
                          type={type}
                          value={customerInfo[key]}
                          onChange={(e) => {
                            const v = key === 'phone' ? e.target.value.replace(/[^0-9+]/g, '') : e.target.value;
                            setCustomerInfo((c) => ({ ...c, [key]: v }));
                            setCheckoutErrors((err) => ({ ...err, [key]: undefined }));
                          }}
                          className={`glass-input w-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 ${checkoutErrors[key] ? 'border-red-400/60' : ''}`}
                          placeholder={placeholder}
                        />
                        {checkoutErrors[key] && <p className="mt-1 text-xs text-red-400">{checkoutErrors[key]}</p>}
                      </div>
                    ))}
                    <div>
                      <label className="block text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-1.5">{t('tour.preferredChatApp')} <span className="text-red-400">*</span></label>
                      <select
                        value={customerInfo.preferredChatApp}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, preferredChatApp: e.target.value })); setCheckoutErrors((err) => ({ ...err, preferredChatApp: undefined })); }}
                        className={`glass-input w-full px-4 py-2.5 text-sm text-white appearance-none ${checkoutErrors.preferredChatApp ? 'border-red-400/60' : ''}`}
                      >
                        <option value="" className="bg-[#0a1628]">{t('tour.pleaseSelect')}</option>
                        <option value="kakao" className="bg-[#0a1628]">KakaoTalk</option>
                        <option value="line" className="bg-[#0a1628]">LINE</option>
                        <option value="wechat" className="bg-[#0a1628]">WeChat</option>
                        <option value="whatsapp" className="bg-[#0a1628]">WhatsApp</option>
                        <option value="telegram" className="bg-[#0a1628]">Telegram</option>
                        <option value="other" className="bg-[#0a1628]">Other</option>
                      </select>
                      {checkoutErrors.preferredChatApp && <p className="mt-1 text-xs text-red-400">{checkoutErrors.preferredChatApp}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cyan-400/80 uppercase tracking-wider mb-1.5">{t('tour.chatAppContact')} <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={customerInfo.chatAppContact}
                        onChange={(e) => { setCustomerInfo((c) => ({ ...c, chatAppContact: e.target.value })); setCheckoutErrors((err) => ({ ...err, chatAppContact: undefined })); }}
                        className={`glass-input w-full px-4 py-2.5 text-sm text-white placeholder:text-gray-500 ${checkoutErrors.chatAppContact ? 'border-red-400/60' : ''}`}
                        placeholder={customerInfo.preferredChatApp === 'line' ? t('tour.enterLineLink') : t('tour.enterChatAppId')}
                      />
                      {checkoutErrors.chatAppContact && <p className="mt-1 text-xs text-red-400">{checkoutErrors.chatAppContact}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* 결제 ?�약 */}
              <div>
                <div className="glass-card p-5 sticky top-24">
                  <h2 className="text-base font-bold bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent mb-4">{t('booking.bookingSummary')}</h2>
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-[10px] font-bold text-cyan-400/70 uppercase tracking-wider mb-1">{t('booking.tourDate')}</label>
                      <input
                        type="date"
                        min={getMinTourDate()}
                        value={tourDate}
                        onChange={(e) => setTourDate(e.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-cyan-400/70 uppercase tracking-wider mb-1">{t('home.customJoinTour.departureTime')}</label>
                      <input
                        type="time"
                        value={departureTime}
                        onChange={(e) => setDepartureTime(e.target.value)}
                        className="glass-input w-full px-3 py-2 text-sm text-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 text-xs pt-3 border-t border-white/10">
                    <div className="flex justify-between text-gray-400">
                      <span>{t('booking.tourDate')}</span>
                      <span className="text-white font-medium">{tourDate || '??} {departureTime}</span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>{t('tour.guests')}</span>
                      <span className="text-white font-medium">{participants}</span>
                    </div>
                    {confirmResult.pricing && (
                      <div className="flex justify-between pt-2 border-t border-white/10">
                        <span className="text-gray-400">{t('tour.total')}</span>
                        <span className="text-base font-bold text-cyan-300">{formatPrice(confirmResult.pricing.totalPriceKrw)}</span>
                      </div>
                    )}
                  </div>
                  {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
                  <button
                    type="button"
                    onClick={handleCheckoutSubmit}
                    disabled={loading}
                    className="mt-4 w-full py-3 rounded-xl text-sm font-bold text-white bg-cyan-500/20 border border-cyan-400/60 shadow-[0_0_18px_rgba(0,255,255,0.25)] hover:bg-cyan-500/30 hover:shadow-[0_0_28px_rgba(0,255,255,0.45)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t('home.customJoinTour.proceedToPayment')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step: Confirmed ???�이�??�크 ?�마 */}
        {step === 'confirmed' && confirmResult && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass-card tech-scanline p-5 sm:p-6 space-y-4"
          >
            {/* ?�공 ?�이�?*/}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 20 }}
              className="text-center pt-2"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-500/15 border-2 border-cyan-400/60 shadow-[0_0_20px_rgba(0,255,255,0.35)] mb-3">
                <Check className="w-7 h-7 text-cyan-400" />
              </div>
              <h2 className="text-base font-bold bg-gradient-to-r from-white to-cyan-300 bg-clip-text text-transparent mb-1">
                {t('home.customJoinTour.confirmSuccess')}
              </h2>
              <p className="text-xs text-cyan-100/70">{t('home.customJoinTour.confirmSuccessDesc')}</p>
            </motion.div>

            {/* ?�금 ?�약 */}
            {confirmResult.pricing && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                className="glass-input px-4 py-3 text-xs text-cyan-100/80 border-cyan-500/20"
              >
                {confirmResult.pricing.vehicleLabelKo} · �?{formatPrice(confirmResult.pricing.totalPriceKrw)}
              </motion.div>
            )}

            {/* ?�주 ?�서 추�??�금 */}
            {confirmResult.jejuCrossRegion && confirmResult.jejuCrossRegionNotice && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.35 }}
                className="rounded-xl bg-amber-500/10 border border-amber-400/40 px-4 py-3"
              >
                <p className="text-xs font-semibold text-amber-300 mb-1">{t('home.customJoinTour.jejuCrossRegionTitle')}</p>
                <p className="text-[11px] text-amber-200/80">{confirmResult.jejuCrossRegionNotice}</p>
                {confirmResult.jejuCrossRegionExtraFeeKrw != null && (
                  <p className="text-[11px] font-medium text-amber-300 mt-2">
                    {t('home.customJoinTour.jejuCrossRegionExtraFee', { amount: locale === 'ko' ? (confirmResult.jejuCrossRegionExtraFeeKrw / 10000).toFixed(0) : formatPrice(confirmResult.jejuCrossRegionExtraFeeKrw) })}
                  </p>
                )}
              </motion.div>
            )}

            {/* CTA 버튼??*/}
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
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-cyan-500/20 backdrop-blur-md border border-cyan-400/60 shadow-[0_0_18px_rgba(0,255,255,0.25)] hover:bg-cyan-500/30 hover:shadow-[0_0_28px_rgba(0,255,255,0.45)] transition-all"
                >
                  {t('home.customJoinTour.proposeThisTour')}
                </button>
              ) : (
                <p className="text-xs text-emerald-400 font-medium py-2 text-center">{t('home.customJoinTour.proposedDone')}</p>
              )}
              <Link
                href="/custom-join-tour/proposed"
                className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-cyan-400 border border-cyan-500/40 hover:border-cyan-400/70 hover:bg-cyan-500/10 transition-all"
              >
                {t('home.proposedTours.viewAll')}
              </Link>
              <Link
                href="/tours"
                className="block w-full text-center py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {t('home.customJoinTour.viewFixedTours')}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
      <AnimatePresence>
        {showGenerateOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#0d1a2e] flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="transition-circuit-bg absolute inset-0 opacity-40" aria-hidden />
            <div className="transition-scanline absolute inset-0 pointer-events-none" aria-hidden />
            <motion.div
              initial={{ y: 20, scale: 0.8 }}
              animate={{ y: [0, -20, 0], scale: 1 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-32 h-32 relative z-10"
            >
              <RobotMascot className="w-full h-full" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="mt-6 text-cyan-400 font-mono tracking-tighter text-sm relative z-10"
            >
              AI ANALYZING YOUR PREFERENCES...
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
