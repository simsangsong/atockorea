// ============================================
// Google Translate API를 사용한 자동 번역 스크립트
// ============================================
// You do NOT need to translate each description by hand. Run this script once
// (or when you add new tours) to auto-fill tours.translations for all languages.
// 번역 대상: title, description, itinerary(schedule), includes, excludes, highlights, faqs, pickup_info, notes
// (상세 설명·일정·포함/미포함·하이라이트·FAQ 등 상세페이지 텍스트 전부)
//
// 제목이 "영어 절반 + 중국어 절반"처럼 섞이면:
// - DB의 tours.title은 반드시 100% 영어로 두세요. 한/중/일이 섞여 있으면 번역이 꼬입니다.
// - FORCE_RETRANSLATE = true 로 바꾼 뒤 스크립트를 다시 실행하면 기존 번역을 덮어씁니다.
//
// 사용 방법 (How to use):
// 1. Get a Google Cloud Translation API key (see docs/batch-translation-guide.md)
// 2. Set GOOGLE_TRANSLATE_API_KEY below
// 3. Log in at /admin
// 4. Open browser DevTools (F12) → Console
// 5. Copy-paste this entire script and run it

// ============================================
// 설정
// ============================================
const GOOGLE_TRANSLATE_API_KEY = 'YOUR_GOOGLE_TRANSLATE_API_KEY_HERE';
const TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

// 번역할 언어 목록 (matches site locales: en is source, others are translated)
const TARGET_LANGUAGES = ['zh', 'zh-TW', 'ko', 'ja', 'es'];

// true로 하면 "이미 번역 있음"인 투어도 다시 번역함 (영어+현지어 섞인 문제 수정 시 true로 재실행 권장)
const FORCE_RETRANSLATE = false;

// 번역 결과가 여전히 영어가 많이 섞여 있는지 확인 (아시아 언어용)
function hasTooMuchLatin(str, maxLatinRatio = 0.35) {
  if (!str || str.length === 0) return false;
  const latin = (str.match(/[a-zA-Z]/g) || []).length;
  return latin / str.length > maxLatinRatio;
}

// 제목 등 짧은 문장: 아시아 언어로 번역 후에도 라틴 문자가 많으면 한 번 더 번역 시도 (전체 번역 유도)
const ASIAN_LANGS = ['zh', 'zh-TW', 'ko', 'ja'];

async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return text;
  // 원문에 이미 한중일 문자가 많으면 번역 소스로 쓰지 않음 (영어만 사용해야 전체 번역됨)
  const nonLatin = (text.match(/[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
  if (nonLatin > 2) {
    console.warn(`  ⚠️ 제목/텍스트에 이미 한·중·일 문자가 있습니다. DB의 title을 영어로 맞춘 뒤 다시 실행하세요: "${text.slice(0, 50)}..."`);
  }

  try {
    const response = await fetch(`${TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target: targetLang === 'zh-TW' ? 'zh-TW' : targetLang,
        source: 'en',
        format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data.translations[0].translatedText;
  } catch (error) {
    console.error(`번역 실패 (${targetLang}):`, error);
    return text;
  }
}

// 제목 전용: 아시아 언어에서 결과가 영어가 많이 섞이면 원문(영어)으로 한 번 더 번역 시도
async function translateTitle(title, targetLang) {
  let result = await translateText(title, targetLang);
  if (ASIAN_LANGS.includes(targetLang) && hasTooMuchLatin(result) && title.match(/^[a-zA-Z\s\-:,'%.]+$/)) {
    await new Promise(r => setTimeout(r, 200));
    const retry = await translateText(title, targetLang);
    if (!hasTooMuchLatin(retry)) result = retry;
  }
  return result;
}

// ============================================
// 투어 번역 생성
// ============================================
async function translateTour(tour) {
  const translations = {};
  
  for (const lang of TARGET_LANGUAGES) {
    console.log(`  📝 ${lang} 번역 중...`);
    
    translations[lang] = {
      title: await translateTitle(tour.title, lang),
      tag: await translateTitle(tour.tag || '', lang),
      subtitle: await translateTitle(tour.subtitle || '', lang),
      description: await translateText(tour.description || '', lang),
      pickup_info: await translateText(tour.pickup_info || '', lang),
      notes: await translateText(tour.notes || '', lang),
    };
    
    // 배열 필드 번역
    if (tour.highlights && Array.isArray(tour.highlights)) {
      translations[lang].highlights = await Promise.all(
        tour.highlights.map(h => translateText(h, lang))
      );
    }
    
    if (tour.includes && Array.isArray(tour.includes)) {
      translations[lang].includes = await Promise.all(
        tour.includes.map(i => translateText(i, lang))
      );
    }
    
    if (tour.excludes && Array.isArray(tour.excludes)) {
      translations[lang].excludes = await Promise.all(
        tour.excludes.map(e => translateText(e, lang))
      );
    }
    
    // 스케줄 번역
    if (tour.schedule && Array.isArray(tour.schedule)) {
      translations[lang].schedule = await Promise.all(
        tour.schedule.map(async (item) => ({
          time: item.time,
          title: await translateText(item.title, lang),
          description: await translateText(item.description || '', lang)
        }))
      );
    }
    
    // FAQ 번역
    if (tour.faqs && Array.isArray(tour.faqs)) {
      translations[lang].faqs = await Promise.all(
        tour.faqs.map(async (faq) => ({
          question: await translateText(faq.question, lang),
          answer: await translateText(faq.answer, lang)
        }))
      );
    }
    
    // API 부하 방지
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return translations;
}

// ============================================
// 메인 실행
// ============================================
(async () => {
  // API 키 확인
  if (!GOOGLE_TRANSLATE_API_KEY || GOOGLE_TRANSLATE_API_KEY === 'YOUR_GOOGLE_TRANSLATE_API_KEY_HERE') {
    console.error('❌ Google Translate API 키를 설정해주세요.');
    console.error('   GOOGLE_TRANSLATE_API_KEY 변수를 수정하세요.');
    return;
  }
  
  // localStorage에서 토큰 가져오기
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
    console.error('❌ 인증 토큰을 찾을 수 없습니다. /admin에서 로그인하세요.');
    return;
  }
  
  console.log('🚀 자동 번역 시작...');
  console.log('');
  
  try {
    // 모든 투어 가져오기
    console.log('📋 투어 목록 가져오는 중...');
    const response = await fetch('/api/admin/tours', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('투어 목록을 가져올 수 없습니다.');
    }
    
    const data = await response.json();
    const tours = data.data || [];
    
    if (tours.length === 0) {
      console.log('⚠️  번역할 투어가 없습니다.');
      return;
    }
    
    console.log(`✅ ${tours.length}개의 투어를 찾았습니다.`);
    console.log('');
    
    // 각 투어 번역
    let successCount = 0;
    let errorCount = 0;
    
    for (const tour of tours) {
      try {
        console.log(`🔄 ${tour.title} 번역 중...`);
        
        // 번역 생성 (description, schedule, includes, highlights, excludes, faqs 등 전체 필드)
        const translations = await translateTour(tour);
        
        // 이미 번역이 있으면 기존 값 위에 새 번역을 병합 (누락된 필드만 채움)
        // FORCE_RETRANSLATE면 새 번역으로 완전히 덮어씀
        let payload = translations;
        if (!FORCE_RETRANSLATE && tour.translations && typeof tour.translations === 'object') {
          payload = {};
          for (const lang of TARGET_LANGUAGES) {
            const existing = tour.translations[lang] || {};
            payload[lang] = { ...existing, ...translations[lang] };
          }
        }
        
        // API 호출
        const updateResponse = await fetch(`/api/admin/tours/${tour.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            translations: payload
          })
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || '업데이트 실패');
        }
        
        console.log(`✅ ${tour.title} - 번역 완료!`);
        console.log(`   중국어: ${payload.zh?.title}`);
        console.log(`   한국어: ${payload.ko?.title}`);
        console.log('');
        
        successCount++;
        
        // API 부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ ${tour.title} - 오류:`, error.message);
        errorCount++;
      }
    }
    
    // 결과 요약
    console.log('');
    console.log('='.repeat(50));
    console.log('📊 자동 번역 완료!');
    console.log('='.repeat(50));
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    
  } catch (error) {
    console.error('');
    console.error('❌ 오류 발생:', error.message);
  }
})();




