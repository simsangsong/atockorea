import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerClient } from '@/lib/supabase';
import {
  buildContext,
  embedBatch,
  EMBED_DIM,
  type PlaceRowForEmbed,
} from '@/lib/places-embedding';
import {
  JEJU_FAMOUS_PLACES,
  SEED_PLACE_ID_START,
  type JejuFamousPlace,
} from '@/lib/constants/jeju-famous-places';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const LANG_NAMES: Record<string, string> = {
  ko: 'Korean',
  en: 'English',
  ja: 'Japanese',
  chs: 'Simplified Chinese',
  cht: 'Traditional Chinese',
  es: 'Spanish',
};

/** 국문 overview 생성 (관광지=역사·특징 / 식당=메뉴·분위기, 금지 문구 없이) */
async function generateOverviewKo(place: JejuFamousPlace): Promise<string> {
  const isRestaurant = place.type === 'restaurant';
  const prompt = isRestaurant
    ? `당신은 제주도 맛집 공식 소개문을 작성하는 전문가입니다.

다음 식당에 대한 **한국어** 소개문을 2~4문장으로 작성하세요.
- 식당: ${place.name_ko} (${place.address_ko})
필수 포함: (1) 어떤 종류 식당인지 (흑돼지·고기국수·갈치구이 등). (2) 대표 메뉴나 요리 방식. (3) 분위기나 위치 특징.
사실에 기반한 구체적 내용만. "유명한", "현지 맛집", "대표" 같은 추상적 표현은 사용하지 마세요.
출력은 소개문만 주세요. 따옴표나 접두어 없이.`
    : `당신은 제주도 관광 공식 소개문을 작성하는 전문가입니다.

다음 관광지에 대한 **한국어** 소개문을 2~4문장으로 작성하세요.
- 장소: ${place.name_ko} (${place.address_ko})
필수 포함 내용: (1) 무엇인지 정의 (예: 화산 기생봉, 해변, 박물관 등). (2) 역사·지정 현황 (UNESCO, 지정 연도, 유래 등). (3) 방문자가 보거나 할 수 있는 것 (일출, 등산, 수영 등).
사실에 기반한 구체적 내용만 사용하세요. "대표 관광지", "유명한", "현지 맛집" 같은 추상적 표현은 사용하지 마세요.
출력은 소개문만 주세요. 따옴표나 접두어 없이.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { maxOutputTokens: 256 },
    });
    const result = await model.generateContent(prompt);
    const text = result.response?.text?.()?.trim();
    if (text && text.length > 50) return text.slice(0, 2000);
  } catch (e) {
    console.warn('[seed-places-overviews] generateOverviewKo failed:', place.name_ko, e);
  }
  return `${place.name_ko}에 대한 상세 정보는 준비 중입니다.`;
}

/** 국문 overview를 지정 언어로 번역 */
async function translateOverview(
  overviewKo: string,
  targetLang: string
): Promise<string> {
  if (targetLang === 'ko') return overviewKo;
  const langName = LANG_NAMES[targetLang] ?? 'English';
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { maxOutputTokens: 256 },
    });
    const result = await model.generateContent(
      `Translate the following Korean travel/attraction description into ${langName}. Preserve all factual content (history, designation, features). Output ONLY the translation, no explanation. Keep length similar, up to 500 characters.\n\n${overviewKo.slice(0, 800)}`
    );
    const text = result.response?.text?.()?.trim();
    if (text && text.length > 20) return text.slice(0, 2000);
  } catch (e) {
    console.warn('[seed-places-overviews] translateOverview failed:', targetLang, e);
  }
  return overviewKo;
}

/** 언어별 title/address (간단 매핑) */
function getTitleAndAddress(
  place: JejuFamousPlace,
  langType: string
): { title: string; address: string } {
  if (langType === 'ko') return { title: place.name_ko, address: place.address_ko };
  if (langType === 'en') return { title: place.name_en, address: place.address_en };
  if (langType === 'ja') {
    return {
      title: place.name_en,
      address: place.address_en,
    };
  }
  return { title: place.name_en, address: place.address_en };
}

const DISCOVER_ID_START = 9_001_100;

/** LLM으로 인스타·소홍서·틱톡·유튜브 등에서 자주 언급되는 제주 장소 목록 생성 */
async function discoverPlacesWithLLM(apiKey: string): Promise<JejuFamousPlace[]> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { maxOutputTokens: 8192 },
  });
  const prompt = `You are a Jeju Island travel expert. List 50-70 real, existing places in Jeju that are frequently mentioned on Instagram, Xiaohongshu (小红书), TikTok, YouTube, and Facebook. Include:
- Natural attractions (beaches, waterfalls, mountains, coastal roads)
- Museums and theme parks
- Restaurants (black pork, meat noodle, grilled fish, seafood, abalone)
- Cafes (aesthetic, ocean view, viral)
- Activities (rail bike, submarine, 9.81 Park, NANTA, yacht)
- Festivals or seasonal spots (rapeseed flower, cherry blossom, etc.)

For each place provide ONLY valid JSON in one array of objects with keys: name_ko (Korean name), name_en (English name), address_ko (full Korean address in 제주특별자치도...), address_en (full English address), type ("attraction" or "restaurant"). Use real place names and real addresses. Output nothing but the JSON array, no markdown.`;
  const result = await model.generateContent(prompt);
  const raw = result.response?.text?.()?.trim() ?? '';
  const cleaned = raw.replace(/```json\s*|\s*```/g, '').trim();
  try {
    const arr = JSON.parse(cleaned) as unknown[];
    return (Array.isArray(arr) ? arr : []).filter(
      (x): x is JejuFamousPlace =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as JejuFamousPlace).name_ko === 'string' &&
        typeof (x as JejuFamousPlace).name_en === 'string'
    ).map((x) => ({
      name_ko: String((x as JejuFamousPlace).name_ko).trim(),
      name_en: String((x as JejuFamousPlace).name_en).trim(),
      address_ko: String((x as JejuFamousPlace).address_ko ?? '').trim(),
      address_en: String((x as JejuFamousPlace).address_en ?? '').trim(),
      type: (x as JejuFamousPlace).type === 'restaurant' ? 'restaurant' as const : undefined,
    }));
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-seed-secret') ?? req.nextUrl.searchParams.get('secret');
  const expected = process.env.SEED_PLACES_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not set.' },
      { status: 500 }
    );
  }

  let placesToSeed: JejuFamousPlace[];
  let idStart: number;
  try {
    const body = (await req.json().catch(() => ({}))) as { discover?: boolean; places?: JejuFamousPlace[] };
    if (body.discover === true) {
      const discovered = await discoverPlacesWithLLM(process.env.GEMINI_API_KEY);
      placesToSeed = discovered.length > 0 ? discovered : JEJU_FAMOUS_PLACES;
      idStart = discovered.length > 0 ? DISCOVER_ID_START : SEED_PLACE_ID_START;
    } else if (Array.isArray(body.places) && body.places.length > 0) {
      placesToSeed = body.places;
      idStart = DISCOVER_ID_START;
    } else {
      placesToSeed = JEJU_FAMOUS_PLACES;
      idStart = SEED_PLACE_ID_START;
    }
  } catch {
    placesToSeed = JEJU_FAMOUS_PLACES;
    idStart = SEED_PLACE_ID_START;
  }

  const supabase = createServerClient();
  const langTypes = ['ko', 'en', 'ja', 'chs', 'cht', 'es'];
  const results: { place: string; id: number; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < placesToSeed.length; i++) {
    const place = placesToSeed[i];
    const id = idStart + i;

    try {
      const overviewKo = await generateOverviewKo(place);
      const overviewByLang: Record<string, string> = { ko: overviewKo };

      for (const lang of langTypes) {
        if (lang === 'ko') continue;
        overviewByLang[lang] = await translateOverview(overviewKo, lang);
      }

      const rows = langTypes.map((langType) => {
        const { title, address } = getTitleAndAddress(place, langType);
        const rawOverview = (overviewByLang[langType] ?? '').trim();
        const overview = rawOverview.slice(0, 2000);
        return {
          id,
          lang_type: langType,
          title: title.trim().slice(0, 200) || place.name_ko.slice(0, 200),
          address: (address ?? '').trim().slice(0, 500) || null,
          image_url: null,
          overview: overview || null,
        };
      });

      const texts = rows.map((r) =>
        buildContext({
          title: r.title,
          address: r.address,
          overview: r.overview,
        } as PlaceRowForEmbed)
      );
      const apiKey = process.env.GEMINI_API_KEY ?? '';
      const embeddings = await embedBatch(texts, apiKey, { batchSize: 6, delayMs: 150 });

      const rowsWithEmbed = rows.map((r, idx) => {
        const vec = embeddings[idx];
        return {
          ...r,
          embedding: Array.isArray(vec) && vec.length === EMBED_DIM ? vec : null,
        };
      });

      const { error } = await supabase.from('places').upsert(
        rowsWithEmbed.map((r) => ({
          id: r.id,
          lang_type: r.lang_type,
          title: r.title,
          address: r.address,
          image_url: r.image_url,
          overview: r.overview,
          embedding: r.embedding,
        })),
        { onConflict: 'id,lang_type', ignoreDuplicates: false }
      );

      if (error) {
        results.push({ place: place.name_ko, id, ok: false, error: error.message });
      } else {
        results.push({ place: place.name_ko, id, ok: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ place: place.name_ko, id, ok: false, error: msg });
    }

    await new Promise((r) => setTimeout(r, 800));
  }

  const okCount = results.filter((r) => r.ok).length;
  const idEnd = idStart + placesToSeed.length;

  const { data: verified, error: verifyErr } = await supabase
    .from('places')
    .select('id, lang_type, title, overview, embedding')
    .gte('id', idStart)
    .lt('id', idEnd);

  const verification = {
    totalRows: Array.isArray(verified) ? verified.length : 0,
    withOverview: Array.isArray(verified) ? verified.filter((r) => r.overview && String(r.overview).length > 0).length : 0,
    withEmbedding: Array.isArray(verified) ? verified.filter((r) => r.embedding != null).length : 0,
    error: verifyErr?.message ?? null,
  };

  return NextResponse.json({
    ok: true,
    seeded: okCount,
    total: placesToSeed.length,
    idRange: [idStart, idEnd],
    results,
    verification,
  });
}
