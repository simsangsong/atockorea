import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { Client, TravelMode } from '@googlemaps/google-maps-services-js';
import {
  CUSTOM_JOIN_TOUR,
  getCustomJoinTourPricing,
  type CustomJoinTourPricing,
} from '@/lib/constants/custom-join-tour';
import { createServerClient } from '@/lib/supabase';
import { getPlaceEnrichment } from '@/lib/places-lookup';

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
  /** 일정 보강(사진·설명)에 쓸 places 언어. 없으면 'ko'(이미 수집된 국문) 사용 */
  placeLang?: 'ko' | 'en';
}

/** 일정 내 한 장소 (관광지 또는 식당). image_url/overview는 places 테이블 보강 시 채워짐 */
export interface SchedulePlace {
  name: string;
  address: string;
  /** attraction(관광지) | restaurant(식당). 없으면 attraction */
  type?: 'attraction' | 'restaurant';
  /** places 테이블 매칭 시 채움 (일정 옆 사진·간략 설명용) */
  image_url?: string | null;
  overview?: string | null;
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
 *  A→B→C→D 순서로 각 구간을 개별 요청하여 합산
 */
async function getDailyDistanceKm(addresses: string[]): Promise<number> {
  if (addresses.length < 2 || !process.env.GOOGLE_MAPS_API_KEY) return 0;
  try {
    let totalMeters = 0;
    // 각 구간을 1:1로 요청 (A→B, B→C, C→D …)
    for (let i = 0; i < addresses.length - 1; i++) {
      const segResponse = await mapsClient.distancematrix({
        params: {
          origins: [addresses[i]],
          destinations: [addresses[i + 1]],
          key: process.env.GOOGLE_MAPS_API_KEY,
          mode: TravelMode.driving,
        },
        timeout: 8000,
      });
      const el = segResponse.data?.rows?.[0]?.elements?.[0];
      if (el?.status === 'OK' && el.distance?.value) {
        totalMeters += el.distance.value;
      }
    }
    return Math.round((totalMeters / 1000) * 10) / 10;
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CustomJoinTourGenerateRequest;
    const customerInput = typeof body.customerInput === 'string' ? body.customerInput.trim() : '';
    const durationNum = parseDuration(body.duration);
    const numberOfParticipants = Number(body.numberOfParticipants);
    const destination = body.destination === 'busan' || body.destination === 'seoul' ? body.destination : 'jeju';

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

    // --- STEP 1: Gemini — 고객 입력 기반 일정 초안 (2.5-flash: 무료 등급 한도에 맞춤) ---
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const regionRule =
      destination === 'jeju'
        ? 'DESTINATION IS JEJU ISLAND (제주도) ONLY. Every single place (attractions and restaurants) MUST be in Jeju Island. Do NOT include Seoul, Busan, or any other region. All addresses must be in Jeju-do (제주특별자치도), South Korea.'
        : destination === 'busan'
          ? 'DESTINATION IS BUSAN ONLY. Every single place MUST be in Busan (부산). Do NOT include Jeju, Seoul, or other regions. All addresses must be in Busan, South Korea.'
          : 'DESTINATION IS SEOUL ONLY. Every single place MUST be in Seoul (서울). Do NOT include Jeju, Busan, or other regions. All addresses must be in Seoul, South Korea.';

    const geminiPrompt = `You are a travel itinerary planner for Korea. The customer wants a custom join tour.

**IMPORTANT: ${regionRule}**

Customer request: "${customerInput}"

Plan a ${durationNum}-day itinerary in ${destination === 'jeju' ? 'Jeju Island' : destination === 'busan' ? 'Busan' : 'Seoul'} only. Each day must have 4 to 5 places total. Return ONLY a valid JSON object (no markdown, no code fences):
{"days":[{"day":1,"places":[{"name":"Exact real place name","address":"Full real address in South Korea","type":"attraction"|"restaurant"}]},{"day":2,"places":[...]},...]}

STRICT RULES:
1. REGION: ${regionRule}
2. REAL PLACES ONLY: Every place must be real, existing venues with correct names and addresses. For restaurants, use actual well-known real restaurants in the chosen region.
3. Each day: exactly 4 or 5 places. Include 1 or 2 restaurant recommendations per day between sightseeing spots. Use "type":"restaurant" or "type":"attraction".
4. Order places in a logical visiting order.
5. If destination is Jeju: Do NOT put East Jeju and West Jeju on the same day. West + South CAN be combined in one day.
6. Return only the JSON object.`;

    let rawText: string;
    try {
      const geminiResult = await model.generateContent(geminiPrompt);
      rawText = geminiResult.response.text();
    } catch (geminiErr: unknown) {
      const msg = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
      const isQuota = /429|quota|Too Many Requests|rate.?limit/i.test(msg);
      if (isQuota) {
        return NextResponse.json(
          { error: '일정 생성 요청이 많습니다. 잠시 후(약 20초) 다시 시도해 주세요.' },
          { status: 503 }
        );
      }
      throw geminiErr;
    }
    const cleanedJson = rawText.replace(/```json\s*|\s*```/g, '').trim();
    const draftJson: DraftItinerary = JSON.parse(cleanedJson);
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
2. Check that the order of places each day is logical (e.g. nearby spots together).
3. If something is wrong or unclear, correct it. Keep the same JSON structure with "type":"attraction" or "type":"restaurant" for each place: {"days":[{"day":1,"places":[{"name":"...","address":"...","type":"attraction"|"restaurant"}]},...]}.
4. Return ONLY the corrected JSON object, no markdown or code fences. If the itinerary is already good, return it unchanged.`;

      try {
        const claudeResponse = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
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

    // --- STEP 3: Distance Matrix — 일별 이동 거리(km) 계산 ---
    const dailyDistancesKm: number[] = [];
    for (const daySchedule of verifiedSchedule) {
      const addresses = daySchedule.places.map((p) => p.address).filter(Boolean);
      const km = await getDailyDistanceKm(addresses);
      dailyDistancesKm.push(km);
    }

    // --- STEP 4: places 테이블 보강 — 관광지 사진·간략 설명 (attraction만). ko → en → ja/chs/cht 순으로 매칭 ---
    try {
      const supabase = createServerClient();
      const langType = body.placeLang === 'en' ? 'en' : 'ko';
      const allPlaces = verifiedSchedule.flatMap((d) => d.places);
      const enrichments = await Promise.all(
        allPlaces.map((p) =>
          p.type === 'restaurant'
            ? Promise.resolve({ image_url: null, overview: null })
            : getPlaceEnrichment(supabase, p.name, p.address, langType)
        )
      );
      let idx = 0;
      let enrichedCount = 0;
      for (const daySchedule of verifiedSchedule) {
        for (const place of daySchedule.places) {
          const e = enrichments[idx++];
          if (e && (e.image_url || e.overview)) {
            place.image_url = e.image_url ?? undefined;
            place.overview = e.overview ?? undefined;
            enrichedCount++;
          }
        }
      }
      if (allPlaces.filter((p) => p.type !== 'restaurant').length > 0 && enrichedCount === 0) {
        console.warn('[custom-join-tour/generate] places 보강 0건: Supabase places 테이블에 데이터가 없거나 이름/주소 매칭 실패. 파이프라인(LANG_FILTER=en 등) 실행 후 재시도.');
      }
    } catch (err) {
      console.warn('[custom-join-tour/generate] places 보강 실패:', err instanceof Error ? err.message : err);
    }

    const limitKm = CUSTOM_JOIN_TOUR.DAILY_DISTANCE_KM_LIMIT;
    const overLimitDays = dailyDistancesKm
      .map((km, i) => (km > limitKm ? i + 1 : 0))
      .filter((d) => d > 0);
    const needRevision = overLimitDays.length > 0;
    const extraFeeNotice = needRevision
      ? `일일 이동 거리가 ${limitKm}km를 초과하는 날이 있습니다 (${overLimitDays.join(', ')}일차). 해당 일정은 추가 요금이 발생할 수 있으니, 방문지를 조정해 주시거나 고객센터로 문의해 주세요.`
      : null;

    const pricing = getCustomJoinTourPricing(numberOfParticipants);
    const guideMessage = needRevision
      ? extraFeeNotice ?? '일정을 확인해 주세요.'
      : '검증된 일정입니다. 즐거운 여행 되세요.';

    const response: CustomJoinTourGenerateResponse = {
      success: !needRevision,
      schedule: verifiedSchedule,
      dailyDistancesKm,
      overLimitDays,
      extraFeeNotice,
      pricing,
      guideMessage,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Custom join tour generate error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate custom join tour.';
    const isQuota = /429|quota|Too Many Requests|rate.?limit/i.test(msg);
    const friendlyError = isQuota
      ? '일정 생성 요청이 많습니다. 잠시 후(약 20초) 다시 시도해 주세요.'
      : msg;
    return NextResponse.json(
      { error: friendlyError },
      { status: isQuota ? 503 : 500 }
    );
  }
}
