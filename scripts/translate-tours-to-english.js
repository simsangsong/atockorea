// ============================================
// 한국어(또는 기타) → 영어 번역으로 translations.en 생성
// ============================================
// 영어 페이지에서 제목이 한국어로 나오는 투어는 DB에 translations.en 이 없기 때문입니다.
// 이 스크립트는 제목/설명 등이 한글이거나 영어 번역이 없을 때
// Google Translate로 영어 번역을 만들어 tours.translations.en 에 저장합니다.
//
// 사용 방법:
// 1. Google Cloud Translation API 키 준비 (auto-translate-tours.js와 동일)
// 2. 아래 GOOGLE_TRANSLATE_API_KEY 설정
// 3. /admin 에서 로그인
// 4. F12 → Console 에 이 스크립트 전체 붙여넣기 후 실행
//
// 옵션:
// - TOUR_SLUG: 특정 투어만 처리하려면 slug 입력 (예: 'jeju-private-car-tour'), 빈 문자열이면 전체
// - TRANSLATE_FULL: true면 description, schedule, highlights 등도 영어로 번역 (시간 걸림)

const GOOGLE_TRANSLATE_API_KEY = 'AIzaSyB_8cEmDHH9ue-028UKfJjhbF3VYHxKl9w';
const TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

const TOUR_SLUG = ''; // 예: 'jeju-private-car-tour' (비우면 모든 '영어 번역 필요' 투어 처리)
const TRANSLATE_FULL = true; // true: 설명/일정/하이라이트 등 전체 번역, false: 제목만

function hasCJK(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(text);
}

function needsEnglishTranslation(tour) {
  const hasEn = tour.translations && tour.translations.en && tour.translations.en.title;
  if (hasEn && !hasCJK(tour.translations.en.title)) return false;
  return hasCJK(tour.title) || !hasEn;
}

async function translateToEnglish(text) {
  if (!text || String(text).trim() === '') return text;
  try {
    const res = await fetch(`${TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: 'en',
        format: 'text'
        // source 생략 시 자동 감지 (한국어 → 영어)
      })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.data.translations[0].translatedText;
  } catch (e) {
    console.warn('Translate failed:', e.message);
    return text;
  }
}

async function buildEnglishTranslation(tour, full) {
  const en = {};
  en.title = await translateToEnglish(tour.title);
  await new Promise(r => setTimeout(r, 150));

  if (full) {
    if (tour.tag) { en.tag = await translateToEnglish(tour.tag); await new Promise(r => setTimeout(r, 100)); }
    if (tour.subtitle) { en.subtitle = await translateToEnglish(tour.subtitle); await new Promise(r => setTimeout(r, 100)); }
    if (tour.description) { en.description = await translateToEnglish(tour.description || ''); await new Promise(r => setTimeout(r, 150)); }
    if (tour.pickup_info) { en.pickup_info = await translateToEnglish(tour.pickup_info); await new Promise(r => setTimeout(r, 100)); }
    if (tour.notes) { en.notes = await translateToEnglish(tour.notes); await new Promise(r => setTimeout(r, 100)); }
    if (Array.isArray(tour.highlights) && tour.highlights.length) {
      en.highlights = await Promise.all(tour.highlights.map(h => translateToEnglish(h)));
      await new Promise(r => setTimeout(r, 150));
    }
    if (Array.isArray(tour.includes) && tour.includes.length) {
      en.includes = await Promise.all(tour.includes.map(i => translateToEnglish(i)));
      await new Promise(r => setTimeout(r, 100));
    }
    if (Array.isArray(tour.excludes) && tour.excludes.length) {
      en.excludes = await Promise.all(tour.excludes.map(e => translateToEnglish(e)));
      await new Promise(r => setTimeout(r, 100));
    }
    if (Array.isArray(tour.schedule) && tour.schedule.length) {
      en.schedule = await Promise.all(tour.schedule.map(async (item) => ({
        time: item.time,
        title: await translateToEnglish(item.title || ''),
        description: await translateToEnglish(item.description || '')
      })));
      await new Promise(r => setTimeout(r, 150));
    }
    if (Array.isArray(tour.faqs) && tour.faqs.length) {
      en.faqs = await Promise.all(tour.faqs.map(async (faq) => ({
        question: await translateToEnglish(faq.question || ''),
        answer: await translateToEnglish(faq.answer || '')
      })));
      await new Promise(r => setTimeout(r, 150));
    }
  }

  return en;
}

(async () => {
  if (!GOOGLE_TRANSLATE_API_KEY || GOOGLE_TRANSLATE_API_KEY.includes('YOUR_')) {
    console.error('❌ GOOGLE_TRANSLATE_API_KEY 를 설정해주세요.');
    return;
  }

  let token = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('auth-token')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        token = data?.access_token || data?.accessToken || data?.session?.access_token;
        if (token) break;
      } catch (e) {}
    }
  }
  if (!token) {
    console.error('❌ 인증 토큰 없음. /admin 에서 로그인 후 다시 실행하세요.');
    return;
  }

  console.log('📋 투어 목록 가져오는 중...');
  const listRes = await fetch('/api/admin/tours', { headers: { 'Authorization': `Bearer ${token}` } });
  if (!listRes.ok) {
    console.error('❌ 투어 목록 조회 실패:', listRes.status);
    return;
  }
  const listData = await listRes.json();
  const tours = listData.data || [];
  if (!tours.length) {
    console.log('⚠️ 투어가 없습니다.');
    return;
  }

  let targetTours = tours;
  if (TOUR_SLUG) {
    const slugLower = TOUR_SLUG.toLowerCase().trim();
    targetTours = tours.filter(t => {
      const s = (t.slug || '').toLowerCase();
      const title = (t.title || '').toLowerCase();
      return s.includes(slugLower) || title.includes(slugLower);
    });
    if (!targetTours.length) {
      console.log('⚠️ slug/제목 "' + TOUR_SLUG + '" 에 해당하는 투어가 없습니다.');
      console.log('');
      console.log('📋 등록된 투어 목록 (slug → 제목):');
      tours.forEach(t => console.log('   ', t.slug || '(slug 없음)', '→', (t.title || '').slice(0, 50)));
      console.log('');
      console.log('TOUR_SLUG 를 위 목록에서 복사하거나, 비우면 "영어 번역 필요한" 전체 투어를 처리합니다.');
      return;
    }
    console.log('🎯 특정 투어만 처리:', targetTours.length, targetTours.map(t => t.title));
  }

  const toProcess = targetTours.filter(t => needsEnglishTranslation(t));
  if (!toProcess.length) {
    console.log('✅ 영어 번역이 필요한 투어가 없습니다.');
    return;
  }

  console.log('🔄 영어 번역 생성할 투어:', toProcess.length, toProcess.map(t => t.title));
  console.log('');

  for (const tour of toProcess) {
    try {
      console.log('📝', tour.title, '→ EN');
      const en = await buildEnglishTranslation(tour, TRANSLATE_FULL);
      const existing = (tour.translations && typeof tour.translations === 'object') ? tour.translations : {};
      const payload = { ...existing, en: { ...(existing.en || {}), ...en } };

      const updateRes = await fetch(`/api/admin/tours/${tour.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ translations: payload })
      });

      if (!updateRes.ok) {
        const err = await updateRes.json();
        throw new Error(err.error || err.details || updateRes.statusText);
      }
      console.log('   ✅ EN title:', en.title);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.error('   ❌', e.message);
    }
  }

  console.log('');
  console.log('🏁 완료. 영어 페이지 새로고침 후 확인하세요.');
})();
