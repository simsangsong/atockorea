// ============================================
// 직접 Supabase를 사용한 일괄 번역 업데이트 스크립트
// ============================================
// API 엔드포인트 대신 Supabase 클라이언트를 직접 사용
// 브라우저 콘솔(F12)에서 실행하세요 (admin 로그인 필요)
//
// 사용 방법:
// 1. /admin에서 로그인
// 2. 브라우저 콘솔(F12) 열기
// 3. 이 스크립트를 복사해서 붙여넣고 실행

(async () => {
  console.log('🚀 직접 Supabase 일괄 번역 업데이트 시작...');
  console.log('');
  
  // Supabase 클라이언트 가져오기
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  
  // Supabase 설정 가져오기
  let supabaseUrl = '';
  let supabaseAnonKey = '';
  
  // 환경 변수에서 가져오기 시도
  if (typeof window !== 'undefined' && window.location) {
    // Next.js 환경 변수는 클라이언트에서 접근 불가
    // 대신 API를 통해 가져오거나 직접 입력
    console.log('⚠️  Supabase 설정이 필요합니다.');
    console.log('   다음 정보를 입력하세요:');
    console.log('   1. Supabase URL (예: https://xxx.supabase.co)');
    console.log('   2. Supabase Anon Key');
    console.log('');
    console.log('   또는 /api/admin/tours 엔드포인트를 사용하는 방법을 권장합니다.');
    return;
  }
  
  // ============================================
  // 번역 템플릿 함수 (기존과 동일)
  // ============================================
  function generateTranslations(englishTour) {
    // 도시별 기본 번역 (모든 언어)
    const cityTranslations = {
      'Busan': { 
        zh: '釜山', 'zh-TW': '釜山', ko: '부산', 
        ja: '釜山', es: 'Busan', en: 'Busan' 
      },
      'Seoul': { 
        zh: '首尔', 'zh-TW': '首爾', ko: '서울', 
        ja: 'ソウル', es: 'Seúl', en: 'Seoul' 
      },
      'Jeju': { 
        zh: '济州岛', 'zh-TW': '濟州島', ko: '제주도', 
        ja: '済州島', es: 'Jeju', en: 'Jeju' 
      }
    };
    
    const city = cityTranslations[englishTour.city] || { 
      zh: '', 'zh-TW': '', ko: '', ja: '', es: '', en: '' 
    };
    
    // 키워드 기반 번역 매핑 (모든 언어)
    const keywordTranslations = {
      'Private Tour': { 
        zh: '私人游', 'zh-TW': '私人遊', ko: '프라이빗 투어',
        ja: 'プライベートツアー', es: 'Tour Privado', en: 'Private Tour'
      },
      'Day Tour': { 
        zh: '一日游', 'zh-TW': '一日遊', ko: '일일 투어',
        ja: '日帰りツアー', es: 'Tour de Día', en: 'Day Tour'
      },
      'Guided Tour': { 
        zh: '导游游', 'zh-TW': '導遊遊', ko: '가이드 투어',
        ja: 'ガイドツアー', es: 'Tour Guiado', en: 'Guided Tour'
      },
      'Car Charter': { 
        zh: '包车服务', 'zh-TW': '包車服務', ko: '차량 대여 서비스',
        ja: 'チャーター車サービス', es: 'Servicio de Alquiler de Coche', en: 'Car Charter'
      },
      'Top Attractions': { 
        zh: '热门景点', 'zh-TW': '熱門景點', ko: '인기 명소',
        ja: '人気スポット', es: 'Principales Atracciones', en: 'Top Attractions'
      },
      'Authentic': { 
        zh: '正宗', 'zh-TW': '正宗', ko: '정통',
        ja: '本格的', es: 'Auténtico', en: 'Authentic'
      },
      'Full-Day': { 
        zh: '全天', 'zh-TW': '全天', ko: '종일',
        ja: '終日', es: 'Día Completo', en: 'Full-Day'
      },
      'Half-Day': { 
        zh: '半天', 'zh-TW': '半天', ko: '반일',
        ja: '半日', es: 'Medio Día', en: 'Half-Day'
      },
      'Bus Tour': {
        zh: '巴士游', 'zh-TW': '巴士遊', ko: '버스 투어',
        ja: 'バスツアー', es: 'Tour en Autobús', en: 'Bus Tour'
      },
      'UNESCO': {
        zh: '联合国教科文组织', 'zh-TW': '聯合國教科文組織', ko: '유네스코',
        ja: 'ユネスコ', es: 'UNESCO', en: 'UNESCO'
      }
    };
    
    // 모든 언어로 제목 번역 생성
    const languages = ['zh', 'zh-TW', 'ko', 'ja', 'es', 'en'];
    const titles = {};
    const tags = {};
    
    languages.forEach(lang => {
      let title = englishTour.title;
      let tag = englishTour.tag || '';
      
      // 키워드 교체
      Object.keys(keywordTranslations).forEach(keyword => {
        if (title.includes(keyword) && keywordTranslations[keyword][lang]) {
          title = title.replace(keyword, keywordTranslations[keyword][lang]);
        }
      });
      
      // 도시명 교체
      if (city[lang]) {
        title = title.replace(englishTour.city, city[lang]);
      }
      
      titles[lang] = title;
      
      // 태그 번역
      if (englishTour.tag) {
        const parts = englishTour.tag.split(' · ');
        if (parts.length === 2) {
          const cityName = city[lang] || parts[0];
          let tourType = parts[1];
          
          // 투어 타입 번역
          if (tourType.includes('Private')) {
            tourType = keywordTranslations['Private Tour'][lang];
          } else if (tourType.includes('Day')) {
            tourType = keywordTranslations['Day Tour'][lang];
          } else if (tourType.includes('Bus')) {
            tourType = keywordTranslations['Bus Tour'][lang];
          }
          
          tags[lang] = `${cityName} · ${tourType}`;
        } else {
          tags[lang] = englishTour.tag;
        }
      } else {
        tags[lang] = '';
      }
    });
    
    // 각 언어별 번역 객체 생성
    const translations = {};
    
    languages.forEach(lang => {
      const subtitles = {
        'zh': '正宗体验',
        'zh-TW': '正宗體驗',
        'ko': '정통 경험',
        'ja': '本格的な体験',
        'es': 'Experiencia Auténtica',
        'en': 'Authentic Experience'
      };
      
      translations[lang] = {
        title: titles[lang],
        tag: tags[lang],
        subtitle: englishTour.subtitle || subtitles[lang] || '',
        description: englishTour.description || '',
        highlights: englishTour.highlights || [],
        includes: englishTour.includes || [],
        excludes: englishTour.excludes || [],
        schedule: englishTour.schedule || [],
        faqs: englishTour.faqs || [],
        pickup_info: englishTour.pickup_info || '',
        notes: englishTour.notes || ''
      };
    });
    
    return translations;
  }
  
  // ============================================
  // API를 통한 업데이트 (권장 방법)
  // ============================================
  console.log('💡 API 엔드포인트를 사용하는 방법을 권장합니다.');
  console.log('   scripts/batch-update-tours-translations.js 파일을 사용하세요.');
  console.log('');
  console.log('   만약 API가 계속 404를 반환한다면:');
  console.log('   1. Next.js 개발 서버를 재시작하세요 (Ctrl+C 후 npm run dev)');
  console.log('   2. 브라우저를 새로고침하세요');
  console.log('   3. /admin에서 다시 로그인하세요');
  console.log('   4. 스크립트를 다시 실행하세요');
})();




