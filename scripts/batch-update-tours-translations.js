// ============================================
// 여러 투어에 일괄 번역 추가 스크립트
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요 (admin 로그인 필요)
//
// 사용 방법:
// 1. /admin에서 로그인
// 2. 브라우저 콘솔(F12) 열기
// 3. 이 스크립트를 복사해서 붙여넣고 실행
// 4. 모든 투어에 번역이 자동으로 추가됩니다

(async () => {
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
  
  console.log('🚀 일괄 번역 업데이트 시작...');
  console.log('');
  console.log('💡 참고: Next.js 개발 서버가 실행 중이어야 합니다.');
  console.log('   404 오류가 발생하면 서버를 재시작하세요 (Ctrl+C 후 npm run dev)');
  console.log('');
  
  // ============================================
  // 번역 템플릿 함수
  // ============================================
  // 영어 제목을 기반으로 번역 생성 (간단한 매핑)
  // 실제로는 번역 API를 사용하거나 전문 번역가의 번역을 사용해야 합니다
  
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
        description: englishTour.description || '', // 실제로는 번역 API 사용 권장
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
  // 모든 투어 가져오기
  // ============================================
  try {
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
      console.log('⚠️  업데이트할 투어가 없습니다.');
      return;
    }
    
    console.log(`✅ ${tours.length}개의 투어를 찾았습니다.`);
    console.log('');
    
    // ============================================
  // 각 투어에 번역 추가
  // ============================================
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (const tour of tours) {
      try {
        // 이미 번역이 있는지 확인
        if (tour.translations && Object.keys(tour.translations).length > 0) {
          console.log(`⏭️  ${tour.title} - 이미 번역이 있습니다. 건너뜁니다.`);
          continue;
        }
        
        console.log(`🔄 ${tour.title} 번역 생성 중...`);
        
        // 번역 생성
        const translations = generateTranslations(tour);
        
        // API 호출 - 쿠키에 토큰이 있는 경우 쿠키 사용
        const headers = {
          'Content-Type': 'application/json'
        };
        
        // Authorization 헤더 추가 (토큰이 있는 경우)
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        const updateResponse = await fetch(`/api/admin/tours/${tour.id}`, {
          method: 'PATCH',
          headers: headers,
          credentials: 'include', // 쿠키 포함
          body: JSON.stringify({
            translations: translations
          })
        });
        
        if (!updateResponse.ok) {
          let errorMessage = `HTTP ${updateResponse.status}`;
          try {
            const errorData = await updateResponse.json();
            errorMessage = errorData.error || errorData.details || errorMessage;
            console.error('❌ API 응답:', errorData);
          } catch (e) {
            const text = await updateResponse.text();
            console.error('❌ API 응답 (텍스트):', text);
            errorMessage = text || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        const result = await updateResponse.json();
        console.log(`✅ ${tour.title} - 번역 추가 완료!`);
        console.log(`   영어: ${translations.en.title}`);
        console.log(`   중국어 간체: ${translations.zh.title}`);
        console.log(`   중국어 번체: ${translations['zh-TW'].title}`);
        console.log(`   한국어: ${translations.ko.title}`);
        console.log(`   일본어: ${translations.ja.title}`);
        console.log(`   스페인어: ${translations.es.title}`);
        console.log('');
        
        successCount++;
        
        // API 부하 방지를 위한 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ ${tour.title} - 오류:`, error.message);
        errors.push({ tour: tour.title, error: error.message });
        errorCount++;
      }
    }
    
    // ============================================
    // 결과 요약
    // ============================================
    console.log('');
    console.log('='.repeat(50));
    console.log('📊 일괄 업데이트 완료!');
    console.log('='.repeat(50));
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${errorCount}개`);
    console.log('');
    
    if (errors.length > 0) {
      console.log('오류 목록:');
      errors.forEach(({ tour, error }) => {
        console.log(`  - ${tour}: ${error}`);
      });
    }
    
    console.log('');
    console.log('💡 참고: 이 스크립트는 기본 번역만 생성합니다.');
    console.log('   더 정확한 번역이 필요하면 수동으로 수정하거나');
    console.log('   번역 API를 사용하는 스크립트를 사용하세요.');
    
  } catch (error) {
    console.error('');
    console.error('❌ 오류 발생:', error.message);
    console.error('');
    console.error('💡 해결 방법:');
    console.error('   1. /admin에서 로그인했는지 확인');
    console.error('   2. API 엔드포인트가 올바른지 확인');
    console.error('   3. 네트워크 연결 확인');
  }
})();

