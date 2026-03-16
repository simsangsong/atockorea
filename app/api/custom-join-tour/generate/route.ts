import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { Client, TravelMode } from '@googlemaps/google-maps-services-js';
import {
  CUSTOM_JOIN_TOUR,
  getCustomJoinTourPricing,
  type CustomJoinTourPricing,
  type HotelLocation,
} from '@/lib/constants/custom-join-tour';
import {
  buildPlaceOperatingRulesPrompt,
  filterUnavailablePlaces,
} from '@/lib/constants/place-operating-rules';
import { createServerClient } from '@/lib/supabase';
import { getPlaceEnrichment, savePlaceTranslation } from '@/lib/places-lookup';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
const mapsClient = new Client({});

/** 요청: 고객이 원하는 내용 + 일수 + 참가 인원 + 목적지 */
export interface CustomJoinTourGenerateRequest {
  /** 고객이 입력한 희망 내용 (테마, 장소, 스타일 등) */
  customerInput: string;
  /** 여행 일수 (예: "3", "3 days", "2일") */
  duration?: string;
  /** 참가 인원 (3~13) */
  numberOfParticipants: number;
  /** 목적지: 제주만 사용 시 모든 장소가 제주도 내에 있어야 함 */
  destination?: 'jeju' | 'busan' | 'seoul';
  /** 호텔(숙소) 위치 — 서귀포 시내/시외 선택 시 인당 +1.5만 원 */
  hotelLocation?: HotelLocation;
  /** 출력 언어(페이지 locale). 일정 장소명·주소·설명을 이 언어로 출력. 예: 'en'|'ko'|'ja'|'zh'|'zh-TW'|'es' */
  placeLang?: string;
  /** 여행 시작 날짜 (ISO 8601, 예: "2025-04-07"). 있으면 요일별 휴장 필터 적용 */
  tourStartDate?: string;
}

/** 일정 내 한 장소 (관광지 또는 식당). image_url/overview 등은 places 테이블 보강 시 채워짐 */
export interface SchedulePlace {
  name: string;
  address: string;
  /** attraction(관광지) | restaurant(식당). 없으면 attraction */
  type?: 'attraction' | 'restaurant';
  /** places 테이블 매칭 시 채움 (일정 옆 사진·간략 설명용) */
  image_url?: string | null;
  overview?: string | null;
  /** 개폐장시간 (LOD open_time) */
  open_time?: string | null;
  /** 이용요금 (LOD use_fee) */
  use_fee?: string | null;
  /** 연락처 (LOD tel) */
  tel?: string | null;
  /** 위도 (places.mapy) */
  mapy?: number | null;
  /** 경도 (places.mapx) */
  mapx?: number | null;
}

/** 일별 일정 (Day 1, 2, ...) */
export interface DaySchedule {
  day: number;
  places: SchedulePlace[];
}

/** Gemini 초안: 일별 장소 목록 */
interface DraftDaySchedule {
  day: number;
  places: Array<{ name: string; address: string; type?: 'attraction' | 'restaurant' }>;
}

interface DraftItinerary {
  days: DraftDaySchedule[];
}

/** API 응답 */
export interface CustomJoinTourGenerateResponse {
  /** 검증/거리 검사 통과 여부. 일일 150km 초과 시 false → 수정 유도 */
  success: boolean;
  /** 일별 검증된 일정 */
  schedule: DaySchedule[];
  /** 일별 이동 거리 (km). 인덱스 = day - 1 */
  dailyDistancesKm: number[];
  /** 150km 초과인 날짜 (1-based). 있으면 추가요금 안내 */
  overLimitDays: number[];
  /** 일일 150km 초과 시 안내 문구 (수정 요청용) */
  extraFeeNotice: string | null;
  /** 차량 및 요금 정보 */
  pricing: CustomJoinTourPricing | null;
  /** Claude 검증 후 가이드 메시지 */
  guideMessage: string;
  /** 클라이언트 표시용 요약 (선택) */
  summary?: string;
  /** 운영 규칙으로 제거된 장소 목록 (클라이언트 안내용) */
  removedPlaces?: Array<{ day: number; name: string; reason: string }>;
}

/** 장소 이름이 호텔·리조트·숙소 등인지 판별 (일정에서는 관광지·식당만 허용) */
function isAccommodation(name: string): boolean {
  const lower = name.toLowerCase().trim();
  const terms = [
    'hotel', 'resort', '호텔', '리조트', 'guesthouse', '게스트하우스',
    '펜션', 'pension', '숙소', 'lodging', 'accommodation', 'stay', '스테이',
  ];
  return terms.some((t) => lower.includes(t));
}

function parseDuration(durationInput: string | undefined): number {
  if (!durationInput || typeof durationInput !== 'string') return 3;
  const s = durationInput.trim();
  const num = parseInt(s, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= 14) return num;
  if (/일|day|days/i.test(s)) {
    const m = s.match(/\d+/);
    if (m) {
      const n = parseInt(m[0], 10);
      if (n >= 1 && n <= 14) return n;
    }
  }
  return 3;
}

/** 일별 연속 구간 거리 합산 (meters → km)
 *  하루 치 A→B→C→D 구간을 Distance Matrix 1회 호출로 조회 (구간별 순차 호출 대신 배치)
 */
async function getDailyDistanceKm(addresses: string[]): Promise<number> {
  if (addresses.length < 2 || !process.env.GOOGLE_MAPS_API_KEY) return 0;
  try {
    const origins = addresses.slice(0, -1);
    const destinations = addresses.slice(1);
    const response = await mapsClient.distancematrix({
      params: {
        origins,
        destinations,
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: TravelMode.driving,
      },
      timeout: 10000,
    });
    const rows = response.data?.rows ?? [];
    let totalMeters = 0;
    for (let i = 0; i < rows.length; i++) {
      const el = rows[i]?.elements?.[i];
      if (el?.status === 'OK' && el.distance?.value) {
        totalMeters += el.distance.value;
      }
    }
    return Math.round((totalMeters / 1000) * 10) / 10;
  } catch {
    return 0;
  }
}

/** 프론트 locale → places lang_type (en, ko, ja, chs, cht, es) */
function localeToPlaceLang(locale: string | undefined): string {
  if (!locale || typeof locale !== 'string') return 'ko';
  const s = locale.trim().toLowerCase();
  if (s === 'en' || s === 'ja' || s === 'ko' || s === 'es') return s;
  if (s === 'zh' || s === 'zh-cn') return 'chs';
  if (s === 'zh-tw') return 'cht';
  return 'ko';
}

/** 출력 언어에 맞는 이름 (프롬프트용) */
function getOutputLanguageName(langType: string): string {
  const names: Record<string, string> = {
    en: 'English',
    ko: 'Korean',
    ja: 'Japanese',
    chs: 'Simplified Chinese',
    cht: 'Traditional Chinese',
    es: 'Spanish',
  };
  return names[langType] ?? 'Korean';
}

/** 국문(ko) overview를 요청 언어로 번역 (다른 언어에 해당 장소 정보가 없을 때 사용) */
async function translateOverviewToLang(
  overview: string,
  targetLang: string
): Promise<string> {
  if (!overview.trim() || targetLang === 'ko') return overview;
  const target = getOutputLanguageName(targetLang);
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(
      `Translate the following Korean official travel/attraction description into ${target}. Preserve all factual content (history, features, designation). Return ONLY the translation, no explanation. Keep full length up to 450 characters.\n\n${overview.slice(0, 700)}`
    );
    const text = result.response?.text?.()?.trim();
    return text && text.length > 0 ? text : overview;
  } catch {
    return overview;
  }
}

/** Claude로 overview 검수 — 환각/과장 제거 후 안전한 문장만 반환 */
async function verifyOverviewWithClaude(
  overview: string,
  placeName: string,
  langType: string
): Promise<string> {
  if (!overview?.trim() || !process.env.ANTHROPIC_API_KEY) return overview;
  const langName = getOutputLanguageName(langType);
  try {
    const res = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `You are a fact-checker. An official-style description of a real place "${placeName}" in ${langName} is below. If it is factual, neutral, and safe (no hallucination), return it EXACTLY as-is. If something is wrong or exaggerated, return a corrected 2–4 sentence version keeping history and features. Reply with ONLY the final text.\n\n${overview.slice(0, 500)}`,
      }],
    });
    const first = res.content[0];
    const text = first && typeof first === 'object' && 'text' in first ? (first as { text: string }).text?.trim() : '';
    return text && text.length > 0 ? text : overview;
  } catch {
    return overview;
  }
}

/** 금지 문구 — 이런 내용이면 "설명 없음"으로 간주하고 재시도 또는 placeholder 사용 */
const OVERVIEW_BANNED_PATTERNS = [
  /well-known\s+attraction/i,
  /popular\s+attraction/i,
  /famous\s+attraction/i,
  /local\s+restaurant\s+in\s+jeju/i,
  /attraction\s+in\s+jeju\s*\.?$/i,
  /restaurant\s+in\s+jeju\s*\.?$/i,
  /대표\s*관광지/i,
  /현지\s*맛집/i,
  /代表.*景点|代表.*景點/i,
];

function isOverviewGenericOrBanned(text: string): boolean {
  if (!text || text.length < 40) return true;
  return OVERVIEW_BANNED_PATTERNS.some((re) => re.test(text));
}

/** AI 생성 실패 또는 금지 문구일 때만 사용. "유명한 관광지" 같은 말 대신 중립 문구만 */
function getOverviewFallback(_placeName: string, langType: string, _type: 'attraction' | 'restaurant'): string {
  const neutral: Record<string, string> = {
    ko: '상세 정보는 준비 중입니다.',
    en: 'Detailed description will be available soon.',
    ja: '詳細情報は準備中です。',
    chs: '详细说明即将提供。',
    cht: '詳細說明即將提供。',
    es: 'La descripción detallada estará disponible pronto.',
  };
  return neutral[langType] ?? neutral.en;
}

/** DB에 없을 때 AI로 관광지/식당 설명 생성. 역사·특징·공식 소개만 허용, 금지 문구 포함 시 재시도 후 placeholder */
async function generateOverviewWithAI(
  placeName: string,
  address: string,
  langType: string,
  type: 'attraction' | 'restaurant'
): Promise<string> {
  const langName = getOutputLanguageName(langType);
  const forbidden =
    'FORBIDDEN (if you use any of these, the response will be rejected): "well-known", "popular", "famous attraction", "local restaurant", "in Jeju Island", "대표 관광지", "현지 맛집".';

  const attractionPrompt = `You are writing an official tourist-board description in ${langName} for "${placeName}" (${address}).

REQUIRED structure — write 2 to 4 short sentences that MUST include:
1) Definition: What it is (e.g. "a volcanic tuff cone", "a beach on the east coast", "a temple built in ...").
2) History or designation: UNESCO status, year formed, or key historical fact.
3) What visitors see or do: crater, sunrise viewing, swimming, etc.

Use only factual, concrete content. ${forbidden}
Output ONLY the description, no prefix or quotes.`;

  const restaurantPrompt = `You are writing an official restaurant description in ${langName} for "${placeName}" (${address}).

REQUIRED: Mention (1) type of cuisine or regional specialty, (2) signature dish or style, (3) atmosphere or location. Factual only. ${forbidden}
Output ONLY the description, no prefix or quotes.`;

  const prompt = type === 'restaurant' ? restaurantPrompt : attractionPrompt;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { maxOutputTokens: 256 },
      });
      const secondHint =
        '\n\n(Second attempt: do NOT repeat a generic phrase like "well-known" or "local restaurant". Write specific facts only.)';
      const result = await model.generateContent(
        attempt === 2 ? `${prompt}${secondHint}` : prompt
      );
      const text = result.response?.text?.()?.trim();
      if (text && text.length > 60 && !isOverviewGenericOrBanned(text)) return text.slice(0, 450);
      if (text && text.length > 60 && attempt === 1) continue; // 첫 시도에서 금지 문구 포함 시 재시도
      if (text && text.length > 60) return text.slice(0, 450);
    } catch {
      if (attempt === 2) break;
    }
  }
  return getOverviewFallback(placeName, langType, type);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CustomJoinTourGenerateRequest;
    const customerInput = typeof body.customerInput === 'string' ? body.customerInput.trim() : '';
    const durationNum = parseDuration(body.duration);
    const numberOfParticipants = Number(body.numberOfParticipants);
    const destination = body.destination === 'busan' || body.destination === 'seoul' ? body.destination : 'jeju';

    // 여행 시작 날짜 파싱 (요일별 휴장 필터용)
    let tourStartDate: Date | undefined;
    if (typeof body.tourStartDate === 'string' && body.tourStartDate) {
      const parsed = new Date(body.tourStartDate);
      if (!isNaN(parsed.getTime())) tourStartDate = parsed;
    }

    if (!customerInput) {
      return NextResponse.json(
        { error: 'customerInput is required.' },
        { status: 400 }
      );
    }

    if (
      numberOfParticipants < CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS ||
      numberOfParticipants > CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS
    ) {
      return NextResponse.json(
        {
          error: `참가 인원은 ${CUSTOM_JOIN_TOUR.MIN_PARTICIPANTS}명에서 ${CUSTOM_JOIN_TOUR.MAX_PARTICIPANTS}명 사이로 입력해 주세요.`,
        },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    // --- STEP 1: Gemini — 고객 입력 기반 일정 초안 (2.5-flash, 출력 토큰 제한으로 응답 단축) ---
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { maxOutputTokens: 4096 },
    });
    const regionRule =
      destination === 'jeju'
        ? 'DESTINATION IS JEJU ISLAND (제주도) ONLY. Every single place (attractions and restaurants) MUST be in Jeju Island. Do NOT include Seoul, Busan, or any other region. All addresses must be in Jeju-do (제주특별자치도), South Korea.'
        : destination === 'busan'
          ? 'DESTINATION IS BUSAN ONLY. Every single place MUST be in Busan (부산). Do NOT include Jeju, Seoul, or other regions. All addresses must be in Busan, South Korea.'
          : 'DESTINATION IS SEOUL ONLY. Every single place MUST be in Seoul (서울). Do NOT include Jeju, Busan, or other regions. All addresses must be in Seoul, South Korea.';

    // 운영 규칙 프롬프트 생성 (영구 폐쇄 + 요일 휴장)
    const operatingRulesPrompt = buildPlaceOperatingRulesPrompt(tourStartDate);

    const outputLang = localeToPlaceLang(body.placeLang);
    const outputLangName = getOutputLanguageName(outputLang);
    const geminiPrompt = `You are a travel itinerary planner for Korea. The customer wants a custom join tour.

**IMPORTANT: ${regionRule}**

**OUTPUT LANGUAGE: All place names and addresses in the JSON MUST be in ${outputLangName}.** If the user's language is English, use English names (e.g. "Seongsan Ilchulbong") and English-style addresses. If Korean, use Korean names and addresses. No mixing.

Customer request: "${customerInput}"

Plan a ${durationNum}-day itinerary in ${destination === 'jeju' ? 'Jeju Island' : destination === 'busan' ? 'Busan' : 'Seoul'} only. Each day must have 4 to 5 places total. Return ONLY a valid JSON object (no markdown, no code fences):
{"days":[{"day":1,"places":[{"name":"Exact real place name in ${outputLangName}","address":"Full real address in South Korea, in ${outputLangName}","type":"attraction"|"restaurant"}]},{"day":2,"places":[...]},...]}

STRICT RULES:
1. REGION: ${regionRule}
2. OUTPUT LANGUAGE: Use ${outputLangName} for every "name" and "address" field in the JSON.
3. NO HOTELS OR ACCOMMODATIONS: Do NOT include hotels, resorts, guesthouses, or any lodging. Only tourist attractions (museums, parks, landmarks, beaches, etc.) and restaurants. "type" must be only "attraction" or "restaurant".
4. REAL PLACES ONLY: Every place must be real, existing venues with correct names and addresses. For restaurants, use actual well-known real restaurants in the chosen region.
5. Each day: exactly 4 or 5 places. Include EXACTLY 1 restaurant per day (no more, no less) placed between sightseeing spots for lunch. Use "type":"restaurant" or "type":"attraction".
6. Order places in a logical visiting order.
7. If destination is Jeju: Do NOT put East Jeju and West Jeju on the same day. West + South CAN be combined in one day.
8. Return only the JSON object.
${operatingRulesPrompt ? `\nOPERATING RESTRICTIONS (MUST FOLLOW):\n${operatingRulesPrompt}` : ''}`;

    let rawText: string;
    try {
      const geminiResult = await model.generateContent(geminiPrompt);
      rawText = geminiResult.response?.text?.()?.trim() ?? '';
      if (!rawText) {
        throw new Error('Gemini returned no text (empty or blocked response).');
      }
    } catch (geminiErr: unknown) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      const isQuota = /429|quota|Too Many Requests|rate.?limit/i.test(msg);
      if (isQuota) {
        return NextResponse.json(
          { error: '일정 생성 요청이 많습니다. 잠시 후(약 20초) 다시 시도해 주세요.' },
          { status: 503 }
        );
      }
      console.error('[custom-join-tour/generate] Gemini error:', geminiErr);
      throw geminiErr;
    }
    const cleanedJson = rawText.replace(/```json\s*|\s*```/g, '').trim();
    let draftJson: DraftItinerary;
    try {
      draftJson = JSON.parse(cleanedJson) as DraftItinerary;
    } catch (parseErr) {
      console.error('[custom-join-tour/generate] JSON parse error:', parseErr);
      return NextResponse.json(
        { error: 'Failed to parse itinerary. Please try again with a clearer request.' },
        { status: 502 }
      );
    }
    const days = Array.isArray(draftJson.days) ? draftJson.days : [];

    if (days.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate itinerary. Please try again with a clearer request.' },
        { status: 502 }
      );
    }

    // --- STEP 2: Claude — 일정 정확성 검증 (장소·주소·순서) ---
    const toPlace = (p: { name?: string; address?: string; type?: string }): SchedulePlace => ({
      name: p.name || '',
      address: p.address || '',
      type: p.type === 'restaurant' ? 'restaurant' : 'attraction',
    });
    let verifiedSchedule: DaySchedule[] = days.map((d) => ({
      day: d.day,
      places: (d.places || []).map(toPlace).filter((p) => p.name || p.address),
    }));

    if (process.env.ANTHROPIC_API_KEY) {
      const claudePrompt = `You are a professional travel guide for Atockorea. Verify this draft itinerary for accuracy and logic.

Draft itinerary (JSON):
${JSON.stringify(verifiedSchedule, null, 2)}

Tasks:
1. Check that place names and addresses are realistic for Korea (Seoul, Busan, Jeju, etc.).
2. Do NOT include hotels, resorts, or accommodations—only tourist attractions and restaurants. Remove any hotel/resort/lodging and replace with a nearby attraction or restaurant if needed.
3. Check that the order of places each day is logical (e.g. nearby spots together).
4. Each day must have EXACTLY 1 restaurant (type:"restaurant"). If a day has 0 or 2+ restaurants, fix it: keep the best one and convert extras to attractions, or add one if missing.
5. If something is wrong or unclear, correct it. Keep the same JSON structure with "type":"attraction" or "type":"restaurant" for each place: {"days":[{"day":1,"places":[{"name":"...","address":"...","type":"attraction"|"restaurant"}]},...]}.
6. Return ONLY the corrected JSON object, no markdown or code fences. If the itinerary is already good, return it unchanged.
${operatingRulesPrompt ? `\nOPERATING RESTRICTIONS — Remove or replace any place that violates these rules:\n${operatingRulesPrompt}` : ''}`;

      try {
        const claudeResponse = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 2048,
          messages: [{ role: 'user', content: claudePrompt }],
        });
        const firstBlock = claudeResponse.content[0];
        const text = firstBlock && typeof firstBlock === 'object' && 'text' in firstBlock ? (firstBlock as { text: string }).text : '';
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}') + 1;
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(text.slice(jsonStart, jsonEnd)) as { days?: DraftDaySchedule[] };
          if (Array.isArray(parsed.days) && parsed.days.length > 0) {
            verifiedSchedule = parsed.days.map((d) => ({
              day: d.day,
              places: (d.places || []).map(toPlace).filter((p) => p.name || p.address),
            }));
          }
        }
      } catch {
        // Keep Gemini draft if Claude fails
      }
    }

    // --- STEP 2.4: 후처리 — 호텔/리조트/숙소 제거 (관광 일정에는 관광지·식당만) ---
    const accommodationRemoved: Array<{ day: number; name: string; reason: string }> = [];
    verifiedSchedule = verifiedSchedule.map((daySchedule) => {
      const kept = daySchedule.places.filter((p) => {
        if (isAccommodation(p.name)) {
          accommodationRemoved.push({
            day: daySchedule.day,
            name: p.name,
            reason: '숙소(호텔/리조트)는 관광 일정에 포함되지 않습니다.',
          });
          return false;
        }
        return true;
      });
      return { ...daySchedule, places: kept };
    });
    if (accommodationRemoved.length > 0) {
      console.info(
        '[custom-join-tour/generate] 숙소 제거:',
        accommodationRemoved.map((r) => `Day${r.day} ${r.name}`).join(', ')
      );
    }

    // --- STEP 2.5: 후처리 필터링 — 영구 폐쇄 및 요일 휴장 장소 제거 ---
    const { filtered: filteredSchedule, removed: removedByRules } = filterUnavailablePlaces(
      verifiedSchedule,
      tourStartDate
    );
    const removedPlaces = [...accommodationRemoved, ...removedByRules];
    if (removedByRules.length > 0) {
      console.info(
        '[custom-join-tour/generate] 운영 규칙으로 제거된 장소:',
        removedByRules.map((r) => `Day${r.day} ${r.name} (${r.reason})`).join(', ')
      );
    }
    verifiedSchedule = filteredSchedule;

    // --- STEP 2.6: 후처리 — 하루 식당 수를 정확히 1개로 강제 조정 ---
    verifiedSchedule = verifiedSchedule.map((daySchedule) => {
      const restaurants = daySchedule.places.filter((p) => p.type === 'restaurant');
      if (restaurants.length <= 1) return daySchedule;
      // 식당이 2개 이상이면 첫 번째만 남기고 나머지는 제거
      let restaurantKept = false;
      const places = daySchedule.places.filter((p) => {
        if (p.type !== 'restaurant') return true;
        if (!restaurantKept) { restaurantKept = true; return true; }
        return false;
      });
      return { ...daySchedule, places };
    });

    // --- STEP 3 & 4 병렬: Distance Matrix(일별 1회) + places 보강 ---
    const supabase = createServerClient();
    const langType = localeToPlaceLang(body.placeLang);
    const allPlaces = verifiedSchedule.flatMap((d) => d.places);
    const distancePromise = Promise.all(
      verifiedSchedule.map((daySchedule) => {
        const addresses = daySchedule.places.map((p) => p.address).filter(Boolean);
        return getDailyDistanceKm(addresses);
      })
    );
    const enrichmentPromise = Promise.all(
      allPlaces.map((p) =>
        p.type === 'restaurant'
          ? Promise.resolve({ image_url: null, overview: null, open_time: null, use_fee: null, tel: null, mapx: null, mapy: null })
          : getPlaceEnrichment(supabase, p.name, p.address, langType)
      )
    ).catch((err) => {
      console.warn('[custom-join-tour/generate] places 보강 실패:', err instanceof Error ? err.message : err);
      return allPlaces.map(() => ({ image_url: null, overview: null, open_time: null, use_fee: null, tel: null, mapx: null, mapy: null }));
    });
    const [dailyDistancesKm, enrichments] = await Promise.all([distancePromise, enrichmentPromise]);

    let idx = 0;
    let enrichedCount = 0;
    for (const daySchedule of verifiedSchedule) {
      for (const place of daySchedule.places) {
        const e = enrichments[idx++] as { image_url: string | null; overview: string | null; open_time?: string | null; use_fee?: string | null; tel?: string | null; mapx?: number | null; mapy?: number | null; from_fallback_lang?: 'ko'; place_id?: number } | undefined;
        if (e) {
          place.image_url = e.image_url ?? undefined;
          place.open_time = e.open_time ?? undefined;
          place.use_fee = e.use_fee ?? undefined;
          place.tel = e.tel ?? undefined;
          place.mapx = e.mapx ?? undefined;
          place.mapy = e.mapy ?? undefined;
          let overview = e.overview ?? undefined;
          if (e.from_fallback_lang === 'ko' && overview && langType !== 'ko') {
            overview = await translateOverviewToLang(overview, langType);
            overview = await verifyOverviewWithClaude(overview, place.name, langType);
            if (e.place_id != null && overview) {
              await savePlaceTranslation(supabase, {
                id: e.place_id,
                lang_type: langType,
                title: place.name,
                address: place.address ?? null,
                image_url: e.image_url ?? null,
                overview,
              });
            }
          }
          if (overview && isOverviewGenericOrBanned(overview)) overview = undefined;
          if (!overview) {
            try {
              const generated = await generateOverviewWithAI(place.name, place.address ?? '', langType, place.type ?? 'attraction');
              if (generated) {
                overview = await verifyOverviewWithClaude(generated, place.name, langType);
                place.overview = overview;
              }
            } catch (err) {
              console.warn('[custom-join-tour/generate] overview 생성 실패:', place.name, err instanceof Error ? err.message : err);
              overview = getOverviewFallback(place.name, langType, place.type ?? 'attraction');
              place.overview = overview;
            }
          }
          if (place.overview === undefined) {
            place.overview = overview ?? getOverviewFallback(place.name, langType, place.type ?? 'attraction');
          }
          if (place.image_url || place.overview) enrichedCount++;
        }
      }
    }
    if (allPlaces.filter((p) => p.type !== 'restaurant').length > 0 && enrichedCount === 0) {
      console.warn('[custom-join-tour/generate] places 보강 0건: Supabase places 테이블에 데이터가 없거나 이름/주소 매칭 실패. 파이프라인(LANG_FILTER=en 등) 실행 후 재시도.');
    }

    const limitKm = CUSTOM_JOIN_TOUR.DAILY_DISTANCE_KM_LIMIT;
    const overLimitDays = dailyDistancesKm
      .map((km, i) => (km > limitKm ? i + 1 : 0))
      .filter((d) => d > 0);
    const needRevision = overLimitDays.length > 0;
    const msgLang = outputLang === 'ko' ? 'ko' : outputLang === 'ja' ? 'ja' : outputLang === 'chs' ? 'zh' : outputLang === 'cht' ? 'zh-TW' : outputLang === 'es' ? 'es' : 'en';
    const extraFeeNoticeByLang: Record<string, string> = {
      ko: `일일 이동 거리가 ${limitKm}km를 초과하는 날이 있습니다 (${overLimitDays.join(', ')}일차). 해당 일정은 추가 요금이 발생할 수 있으니, 방문지를 조정해 주시거나 고객센터로 문의해 주세요.`,
      en: `Daily distance exceeds ${limitKm}km on day(s) ${overLimitDays.join(', ')}. Additional fee may apply; please adjust the itinerary or contact us.`,
      ja: `${limitKm}kmを超える日があります（${overLimitDays.join('・')}日目）。追加料金がかかる場合があります。`,
      zh: `第 ${overLimitDays.join('、')} 天行程超过 ${limitKm} 公里，可能产生额外费用。`,
      'zh-TW': `第 ${overLimitDays.join('、')} 天行程超過 ${limitKm} 公里，可能產生額外費用。`,
      es: `La distancia diaria supera ${limitKm} km en el/los día(s) ${overLimitDays.join(', ')}. Puede aplicar un cargo adicional.`,
    };
    const extraFeeNotice = needRevision ? (extraFeeNoticeByLang[msgLang] ?? extraFeeNoticeByLang.en) : null;
    const guideMessageByLang: Record<string, string> = {
      ko: needRevision ? '일정을 확인해 주세요.' : '검증된 일정입니다. 즐거운 여행 되세요.',
      en: needRevision ? 'Please review the itinerary.' : 'Your itinerary has been verified. Have a great trip!',
      ja: needRevision ? '行程をご確認ください。' : '行程が検証されました。良い旅を！',
      zh: needRevision ? '请确认行程。' : '行程已验证，祝您旅途愉快！',
      'zh-TW': needRevision ? '請確認行程。' : '行程已通過檢查，祝您旅途愉快！',
      es: needRevision ? 'Por favor revisa el itinerario.' : 'Tu itinerario ha sido verificado. ¡Buen viaje!',
    };
    const guideMessage = guideMessageByLang[msgLang] ?? guideMessageByLang.en;

    const hotelLocation = body.hotelLocation && ['jeju_city', 'jeju_outside', 'seogwipo_city', 'seogwipo_outside'].includes(body.hotelLocation)
      ? (body.hotelLocation as HotelLocation)
      : undefined;
    const pricing = getCustomJoinTourPricing(numberOfParticipants, hotelLocation);

    const response: CustomJoinTourGenerateResponse = {
      success: !needRevision,
      schedule: verifiedSchedule,
      dailyDistancesKm,
      overLimitDays,
      extraFeeNotice,
      pricing,
      guideMessage,
      ...(removedPlaces.length > 0 && { removedPlaces }),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Custom join tour generate error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate custom join tour.';
    const isQuota = /429|quota|Too Many Requests|rate.?limit/i.test(msg);
    const friendlyError = isQuota
      ? '일정 생성 요청이 많습니다. 잠시 후(약 20초) 다시 시도해 주세요.'
      : msg;
    const body: { error: string; detail?: string } = { error: friendlyError };
    if (process.env.NODE_ENV === 'development' && error instanceof Error && error.stack) {
      body.detail = error.stack;
    }
    return NextResponse.json(
      body,
      { status: isQuota ? 503 : 500 }
    );
  }
}
