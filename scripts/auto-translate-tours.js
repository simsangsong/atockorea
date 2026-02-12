// ============================================
// Google Translate API를 사용한 자동 번역 스크립트
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요 (admin 로그인 필요)
//
// 사용 방법:
// 1. Google Cloud Console에서 Translation API 키 발급
// 2. 아래 API_KEY에 키 입력
// 3. /admin에서 로그인
// 4. 브라우저 콘솔(F12) 열기
// 5. 이 스크립트를 복사해서 붙여넣고 실행

// ============================================
// 설정
// ============================================
const GOOGLE_TRANSLATE_API_KEY = 'YOUR_GOOGLE_TRANSLATE_API_KEY_HERE';
const TRANSLATE_API_URL = 'https://translation.googleapis.com/language/translate/v2';

// 번역할 언어 목록
const TARGET_LANGUAGES = ['zh', 'zh-TW', 'ko'];

// ============================================
// 번역 함수
// ============================================
async function translateText(text, targetLang) {
  if (!text || text.trim() === '') return text;
  
  try {
    const response = await fetch(`${TRANSLATE_API_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        target: targetLang === 'zh-TW' ? 'zh-TW' : targetLang,
        source: 'en'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.data.translations[0].translatedText;
  } catch (error) {
    console.error(`번역 실패 (${targetLang}):`, error);
    return text; // 번역 실패 시 원문 반환
  }
}

// ============================================
// 투어 번역 생성
// ============================================
async function translateTour(tour) {
  const translations = {};
  
  for (const lang of TARGET_LANGUAGES) {
    console.log(`  📝 ${lang} 번역 중...`);
    
    translations[lang] = {
      title: await translateText(tour.title, lang),
      tag: await translateText(tour.tag || '', lang),
      subtitle: await translateText(tour.subtitle || '', lang),
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
        // 이미 번역이 있는지 확인
        if (tour.translations && Object.keys(tour.translations).length > 0) {
          console.log(`⏭️  ${tour.title} - 이미 번역이 있습니다. 건너뜁니다.`);
          continue;
        }
        
        console.log(`🔄 ${tour.title} 번역 중...`);
        
        // 번역 생성
        const translations = await translateTour(tour);
        
        // API 호출
        const updateResponse = await fetch(`/api/admin/tours/${tour.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            translations: translations
          })
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || '업데이트 실패');
        }
        
        console.log(`✅ ${tour.title} - 번역 완료!`);
        console.log(`   중국어: ${translations.zh.title}`);
        console.log(`   한국어: ${translations.ko.title}`);
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




