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

/** Tour theme keywords — cyber-tag color variant per label (visual only) */
const TOUR_THEME_KEYWORDS: Array<{ label: string; cyberColor: 'yellow' | 'orange' | 'pink' | 'green' | 'teal' }> = [
  { label: 'UNESCO Heritage', cyberColor: 'yellow' },
  { label: 'Sunrise & Sunset', cyberColor: 'orange' },
  { label: 'K-Drama Locations', cyberColor: 'pink' },
  { label: 'Local Food & Cafes', cyberColor: 'green' },
  { label: 'Nature & Healing', cyberColor: 'teal' },
];

/** 사이버펑크 HUD 스타일 밴 아이콘 (측면, 창문·헤드라이트·바퀴 털) */
function VanIconWireframe({ active, large }: { active: boolean; large?: boolean }) {
  const s = active ? '#00f0ff' : '#7a8fa6';
  const sf = active ? 'rgba(0,240,255,0.07)' : 'rgba(255,255,255,0.04)';
  const sw = active ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.08)';
  const sd = active ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.2)';

  if (!large) {
    // Staria: tall boxy SUV-van — flat roof, short hood, square body
    return (
      <g fill="none" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* main body — tall boxy shape */}
        <path d="M6 36 L6 10 Q6 6 10 6 L64 6 Q68 6 68 10 L68 36 Z" fill={sf} />
        {/* front hood step (short) */}
        <path d="M6 10 L6 18 L14 18 L14 6" fill="none" stroke={s} strokeWidth="1.2" opacity="0.5" />
        {/* windshield — near-vertical */}
        <path d="M14 6 L14 18 L22 18 L22 6 Z" fill={sw} />
        {/* side windows row */}
        <rect x="24" y="8" width="12" height="9" rx="1.5" fill={sw} />
        <rect x="38" y="8" width="12" height="9" rx="1.5" fill={sw} />
        <rect x="52" y="8" width="10" height="9" rx="1.5" fill={sw} />
        {/* door dividers */}
        <line x1="36" y1="6" x2="36" y2="36" strokeWidth="1" stroke={sd} />
        <line x1="50" y1="6" x2="50" y2="36" strokeWidth="1" stroke={sd} />
        {/* body crease line */}
        <line x1="6" y1="26" x2="68" y2="26" strokeWidth="0.7" stroke={sd} />
        {/* headlight — square */}
        <rect x="6" y="19" width="6" height="5" rx="1" fill={s} opacity="0.8" />
        {/* taillight */}
        <rect x="63" y="19" width="4" height="5" rx="1" fill={s} opacity="0.8" />
        {/* front bumper bar */}
        <line x1="6" y1="33" x2="14" y2="33" strokeWidth="1.2" stroke={s} opacity="0.5" />
        {/* rear bumper bar */}
        <line x1="58" y1="33" x2="68" y2="33" strokeWidth="1.2" stroke={s} opacity="0.5" />
        {/* front wheel */}
        <circle cx="19" cy="36" r="6.5" fill="#0a0f1e" />
        <circle cx="19" cy="36" r="6.5" />
        <circle cx="19" cy="36" r="3.2" strokeWidth="1" />
        <circle cx="19" cy="36" r="1.1" fill={s} stroke="none" />
        {/* rear wheel */}
        <circle cx="55" cy="36" r="6.5" fill="#0a0f1e" />
        <circle cx="55" cy="36" r="6.5" />
        <circle cx="55" cy="36" r="3.2" strokeWidth="1" />
        <circle cx="55" cy="36" r="1.1" fill={s} stroke="none" />
      </g>
    );
  }

  // Solati: long high-roof bus-van — flat front face, panoramic windshield, many windows
  return (
    <g fill="none" stroke={s} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {/* main body — long flat box */}
      <path d="M4 38 L4 8 Q4 4 8 4 L78 4 Q82 4 82 8 L82 38 Z" fill={sf} />
      {/* flat front face */}
      <line x1="4" y1="8" x2="4" y2="32" strokeWidth="1" stroke={sd} />
      {/* large front windshield — nearly full-width front */}
      <rect x="5" y="5" width="14" height="14" rx="1" fill={sw} />
      {/* side windows — 4 uniform windows */}
      <rect x="22" y="7" width="12" height="10" rx="1.5" fill={sw} />
      <rect x="36" y="7" width="12" height="10" rx="1.5" fill={sw} />
      <rect x="50" y="7" width="12" height="10" rx="1.5" fill={sw} />
      <rect x="64" y="7" width="12" height="10" rx="1.5" fill={sw} />
      {/* door dividers */}
      <line x1="20" y1="4" x2="20" y2="38" strokeWidth="1" stroke={sd} />
      <line x1="62" y1="4" x2="62" y2="38" strokeWidth="1" stroke={sd} />
      {/* body crease line */}
      <line x1="4" y1="28" x2="82" y2="28" strokeWidth="0.7" stroke={sd} />
      {/* headlight — rectangular */}
      <rect x="5" y="21" width="7" height="5" rx="1" fill={s} opacity="0.8" />
      {/* taillight */}
      <rect x="76" y="21" width="5" height="5" rx="1" fill={s} opacity="0.8" />
      {/* front bumper */}
      <line x1="4" y1="35" x2="18" y2="35" strokeWidth="1.2" stroke={s} opacity="0.5" />
      {/* rear bumper */}
      <line x1="66" y1="35" x2="82" y2="35" strokeWidth="1.2" stroke={s} opacity="0.5" />
      {/* front wheel */}
      <circle cx="20" cy="38" r="7" fill="#0a0f1e" />
      <circle cx="20" cy="38" r="7" />
      <circle cx="20" cy="38" r="3.5" strokeWidth="1" />
      <circle cx="20" cy="38" r="1.2" fill={s} stroke="none" />
      {/* rear wheel */}
      <circle cx="66" cy="38" r="7" fill="#0a0f1e" />
      <circle cx="66" cy="38" r="7" />
      <circle cx="66" cy="38" r="3.5" strokeWidth="1" />
      <circle cx="66" cy="38" r="1.2" fill={s} stroke="none" />
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

/** Format price in KRW for display: numeric (no "만"). Uses currency context for USD when selected. */
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

  /** 새 창에서 열었을 때 localStorage에서 일정 복원 */
  useEffect(() => {
    if (searchParams.get('open') !== 'itinerary') return;
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY_ITINERARY) : null;
      if (!raw) return;
      const data = JSON.parse(raw) as { schedule: DaySchedule[]; dailyDistancesKm: number[]; overLimitDays: number[]; extraFeeNotice: string | null; pricing: GenerateResult['pricing']; guideMessage: string };
      setSchedule((data.schedule || []).map((d, di) => ({
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
      setSchedule((data.schedule || []).map((d, di) => ({
        ...d,
        places: d.places.map((p, pi) => ({ ...p, _uid: `p-${di}-${pi}-${Date.now()}-${Math.random().toString(36).slice(2)}` })),
      })));
      setDailyDistancesKm(data.dailyDistancesKm || []);
      setOverLimitDays(data.overLimitDays || []);
      setExtraFeeNotice(data.extraFeeNotice ?? null);
      setPricing(data.pricing ? { totalPriceKrw: data.pricing.totalPriceKrw, vehicleLabelKo: data.pricing.vehicleLabelKo, participants: data.pricing.participants } : null);
      setGuideMessage(data.guideMessage || '');
      const payload = {
        schedule: data.schedule || [],
        dailyDistancesKm: data.dailyDistancesKm || [],
        overLimitDays: data.overLimitDays || [],
        extraFeeNotice: data.extraFeeNotice ?? null,
        pricing: data.pricing ? { totalPriceKrw: data.pricing.totalPriceKrw, vehicleLabelKo: data.pricing.vehicleLabelKo, participants: data.pricing.participants } : null,
        guideMessage: data.guideMessage || '',
      };
      try {
        window.localStorage.setItem(STORAGE_KEY_ITINERARY, JSON.stringify(payload));
        // open itinerary in new tab; keep form page as-is
        setTimeout(() => {
          window.open(`${window.location.pathname}?open=itinerary`, '_blank');
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
  const isDarkTheme = step !== 'checkout' && step !== 'confirmed';

  const fieldClass = 'w-full bg-white border-none rounded-xl px-4 py-3 text-sm font-medium text-slate-800 shadow-sm focus:ring-2 focus:ring-slate-900 outline-none appearance-none cursor-pointer transition-colors';
  const labelClass = 'block text-[11px] font-bold text-black uppercase tracking-wider mb-1.5 ml-1';

  return (
    <div className={`min-h-screen ${isDarkTheme ? 'tour-planner-page bg-[#050B18] text-white' : 'bg-white text-neutral-900'}`}>
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-3xl">
        {/* Single-column form */}
        {showDashboard && (
          <div className="flex flex-col gap-6">
            {/* Tour Design Form — glassmorphism */}
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
                    ← {t('home.customJoinTour.backToProposed')}
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
              {/* Destination map — full-width */}
              <div className="tour-map-block w-full relative overflow-hidden" style={{
                background: '#050B18',
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
                <div className="flex flex-col items-center gap-1 py-3 px-6 lg:px-8 relative z-20">
                  <p className="text-[#00ffff] text-lg font-bold text-center" style={{ textShadow: '0 0 8px rgba(0,255,255,0.6)' }}>
                    {destination === 'busan' ? 'Busan' : destination === 'seoul' ? 'Seoul' : 'Jeju Island'}
                  </p>
                  <select
                    value={destination ?? 'jeju'}
                    onChange={(e) => setDestination((e.target.value as 'jeju' | 'busan' | 'seoul') || null)}
                    className="mt-1 text-sm text-[#00f0ff] bg-transparent border border-[rgba(0,240,255,0.3)] rounded px-2 py-1 cursor-pointer outline-none focus:ring-1 focus:ring-[#00f0ff]"
                    aria-label={t('home.customJoinTour.destinationLabel')}
                  >
                    <option value="jeju">Jeju Island</option>
                    <option value="busan" disabled>Busan ({t('home.customJoinTour.comingSoon')})</option>
                    <option value="seoul" disabled>Seoul ({t('home.customJoinTour.comingSoon')})</option>
                  </select>
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
                    { value: 'ko', label: `🇰🇷 ${t('home.customJoinTour.guideKorean')}` },
                    { value: 'en', label: `🇺🇸 ${t('home.customJoinTour.guideEnglish')}` },
                    { value: 'zh', label: `🇨🇳 ${t('home.customJoinTour.guideChinese')}` },
                    { value: 'ja', label: `🇯🇵 ${t('home.customJoinTour.guideJapanese')}` },
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
                    <svg viewBox="0 0 74 46" className="w-20 h-auto shrink-0" style={{ filter: participants <= 6 ? 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.7))' : 'drop-shadow(0 0 4px rgba(255,255,255,0.2))' }} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <VanIconWireframe active={participants <= 6} />
                    </svg>
                    <div className="text-sm font-bold text-center">{t('home.customJoinTour.vehicleVanLabel')}</div>
                    <div className="text-[10px] opacity-80 text-center">{t('home.customJoinTour.vehicleVanPrice')}</div>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input type="radio" name="vehicle" className="peer sr-only" checked={participants >= 7} onChange={() => setParticipants((p) => Math.max(7, p))} />
                  <div className={`cyber-vehicle-card ${participants >= 7 ? 'selected' : ''}`}>
                    <svg viewBox="0 0 86 50" className="w-20 h-auto shrink-0" style={{ filter: participants >= 7 ? 'drop-shadow(0 0 6px rgba(0, 240, 255, 0.7))' : 'drop-shadow(0 0 4px rgba(255,255,255,0.2))' }} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <VanIconWireframe active={participants >= 7} large />
                    </svg>
                    <div className="text-sm font-bold text-center">{t('home.customJoinTour.vehicleLargeVanLabel')}</div>
                    <div className="text-[10px] opacity-80 text-center">₩90,000 / person</div>
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
                <span className="absolute bottom-2 right-2 text-[10px] text-cyan-400/80">AI Powered ✨</span>
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
                {t('home.customJoinTour.generateButton')} ✨
              </button>
              </div>{/* end px-6 lg:px-8 pb-6 lg:pb-8 */}
            </motion.div>

          </div>
        )}

        {/* Step: Itinerary — new tab view */}
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
            {pricing && <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.35 }} className="glass-input px-4 py-3 text-xs text-gray-300 mb-4">{pricing.vehicleLabelKo} · {participants}명 · 총 {formatPrice(pricing.totalPriceKrw)}</motion.div>}
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
                    {dailyDistancesKm[dayIndex] != null && <span className="text-[11px] text-gray-400">이동 거리 약 {dailyDistancesKm[dayIndex]} km</span>}
                  </div>
                  <ul className="space-y-4">
                    {daySchedule.places.map((place, placeIndex) => (
                      <motion.li
                        key={(place as { _uid?: string })._uid ?? `day-${dayIndex}-${placeIndex}`}
                        initial={{ opacity: 0, x: -24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + dayIndex * 0.15 + placeIndex * 0.1, duration: 0.4, ease: 'easeOut' }}
                        className="relative pl-8"
                      >
                        <div className="absolute left-0 top-4 w-6 h-6 rounded-full bg-[#050B18] border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_8px_rgba(0,255,255,0.4)] z-10">
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
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded border border-amber-500/50 text-amber-400 shrink-0"><UtensilsCrossed size={10} /> 식당</span>
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
              {loading ? '검수 중…' : t('home.customJoinTour.confirmItinerary')}
            </motion.button>
          </motion.div>
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
                        <span className="text-lg font-bold text-gray-900">{formatPrice(confirmResult.pricing.totalPriceKrw)}</span>
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
                {confirmResult.pricing.vehicleLabelKo} · 총 {formatPrice(confirmResult.pricing.totalPriceKrw)}
              </div>
            )}
            {confirmResult.jejuCrossRegion && confirmResult.jejuCrossRegionNotice && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                <p className="text-xs font-semibold text-amber-900 mb-1">{t('home.customJoinTour.jejuCrossRegionTitle')}</p>
                <p className="text-[11px] text-amber-800">{confirmResult.jejuCrossRegionNotice}</p>
                {confirmResult.jejuCrossRegionExtraFeeKrw != null && (
                  <p className="text-[11px] font-medium text-amber-900 mt-2">
                    {t('home.customJoinTour.jejuCrossRegionExtraFee', { amount: locale === 'ko' ? (confirmResult.jejuCrossRegionExtraFeeKrw / 10000).toFixed(0) : formatPrice(confirmResult.jejuCrossRegionExtraFeeKrw) })}
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
      <AnimatePresence>
        {showGenerateOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-[#050B18] flex flex-col items-center justify-center overflow-hidden"
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
