// ============================================
// 번역된 투어 데이터 적용 스크립트
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요 (admin 로그인 필요)
//
// 사용 방법:
// 1. export-all-tours-for-translation.js로 데이터 추출
// 2. ChatGPT에서 번역 받은 데이터를 아래 translatedTours 변수에 붙여넣기
// 3. /admin에서 로그인
// 4. 브라우저 콘솔(F12)에서 이 스크립트 실행
//
// 번역 데이터 형식:
// 각 투어 객체에 translations 필드가 있어야 합니다:
// {
//   id: "tour-id",
//   translations: {
//     en: { title: "...", description: "...", ... },
//     zh: { title: "...", description: "...", ... },
//     "zh-TW": { title: "...", description: "...", ... },
//     ko: { title: "...", description: "...", ... },
//     ja: { title: "...", description: "...", ... },
//     es: { title: "...", description: "...", ... }
//   }
// }

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
  
  console.log('🚀 번역 적용 시작...');
  console.log('');
  console.log('💡 참고: Next.js 개발 서버가 실행 중이어야 합니다.');
  console.log('');
  
  // ============================================
  // 여기에 ChatGPT에서 받은 번역 데이터를 붙여넣으세요
  // ============================================
  const translatedTours = [
    // 예시 형식 (ChatGPT에서 받은 실제 번역 데이터로 교체):
    // {
    //   id: "tour-id-1",
    //   slug: "tour-slug-1",
    //   translations: {
    //     en: {
    //       // 기본 정보
    //       title: "English Title",
    //       subtitle: "English Subtitle",
    //       tagline: "English Tagline",
    //       tag: "English Tag",
    //       location: "English Location",
    //       // 설명 및 상세 정보
    //       description: "English description...",
    //       highlight: "English highlight text",
    //       // 메타 정보
    //       difficulty: "Easy",
    //       groupSize: "Up to 10 people",
    //       badges: ["Badge 1", "Badge 2"],
    //       quickFacts: ["Fact 1", "Fact 2"],
    //       // 픽업 및 안내
    //       pickup_info: "Pickup information...",
    //       notes: "Important notes...",
    //       // 픽업 지점
    //       pickup_points: [
    //         { id: "pp-1", name: "Pickup Point Name", address: "Address", pickup_time: null }
    //       ],
    //       // 컨텐츠 배열
    //       highlights: ["Highlight 1", "Highlight 2"],
    //       includes: ["Include 1", "Include 2"],
    //       excludes: ["Exclude 1"],
    //       schedule: [
    //         { time: "09:00", title: "Schedule Title", description: "Schedule Description" }
    //       ],
    //       faqs: [
    //         { question: "Question?", answer: "Answer." }
    //       ]
    //     },
    //     zh: { ... },      // 중국어 간체
    //     "zh-TW": { ... }, // 중국어 번체
    //     ko: { ... },      // 한국어
    //     ja: { ... },      // 일본어
    //     es: { ... }       // 스페인어
    //   }
    // }
  ];
  
  if (translatedTours.length === 0) {
    console.error('❌ 번역 데이터가 없습니다. translatedTours 배열에 번역 데이터를 추가하세요.');
    return;
  }
  
  console.log(`📋 ${translatedTours.length}개의 투어 번역을 적용합니다.`);
  console.log('');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  let successCount = 0;
  let errorCount = 0;
  
  // 각 투어에 대해 번역 적용
  for (let i = 0; i < translatedTours.length; i++) {
    const tour = translatedTours[i];
    const tourId = tour.id;
    const slug = tour.slug;
    const translations = tour.translations || {};
    
    if (!tourId && !slug) {
      console.error(`❌ [${i + 1}/${translatedTours.length}] 투어 ID 또는 slug가 없습니다. 건너뜁니다.`);
      errorCount++;
      continue;
    }
    
    console.log(`[${i + 1}/${translatedTours.length}] ${tour.translations?.en?.title || tour.translations?.ko?.title || slug || tourId} 처리 중...`);
    
    try {
      // 먼저 기존 투어 데이터 가져오기
      const fetchUrl = `/api/tours/${encodeURIComponent(tourId || slug)}`;
      const fetchResponse = await fetch(fetchUrl);
      
      if (!fetchResponse.ok) {
        throw new Error(`투어를 찾을 수 없습니다: ${fetchResponse.status}`);
      }
      
      const fetchResult = await fetchResponse.json();
      const existingTour = fetchResult.tour;
      
      if (!existingTour) {
        throw new Error('투어 데이터를 찾을 수 없습니다.');
      }
      
      // 번역 데이터를 기존 데이터 구조에 맞게 변환
      // Supabase의 translations JSONB 컬럼 형식으로 변환
      const updateData = {
        translations: {}
      };
      
      // 각 언어별 번역 추가
      const languages = ['en', 'zh', 'zh-TW', 'ko', 'ja', 'es'];
      languages.forEach(lang => {
        if (translations[lang]) {
          const langTranslations = translations[lang];
          updateData.translations[lang] = {
            // 기본 정보
            title: langTranslations.title || existingTour.title,
            subtitle: langTranslations.subtitle || existingTour.subtitle,
            tagline: langTranslations.tagline || existingTour.tagline || existingTour.subtitle,
            tag: langTranslations.tag || existingTour.tag,
            location: langTranslations.location || existingTour.location,
            
            // 설명 및 상세 정보
            description: langTranslations.description || existingTour.overview || existingTour.description,
            highlight: langTranslations.highlight || existingTour.highlight,
            
            // 메타 정보
            difficulty: langTranslations.difficulty || existingTour.difficulty,
            groupSize: langTranslations.groupSize || existingTour.groupSize,
            badges: langTranslations.badges || existingTour.badges || [],
            quickFacts: langTranslations.quickFacts || existingTour.quickFacts || [],
            
            // 픽업 및 안내 정보
            pickup_info: langTranslations.pickup_info || existingTour.pickupInfo,
            notes: langTranslations.notes || existingTour.notes,
            
            // 픽업 지점 (name과 address 번역 포함)
            pickup_points: langTranslations.pickup_points || (existingTour.pickupPoints?.map(pp => ({
              id: pp.id,
              name: pp.name,
              address: pp.address,
              pickup_time: pp.pickup_time
            })) || []),
            
            // 컨텐츠 배열
            highlights: langTranslations.highlights || existingTour.highlights || [],
            includes: langTranslations.includes || existingTour.inclusions?.map(inc => inc.text || inc) || existingTour.includes || [],
            excludes: langTranslations.excludes || existingTour.exclusions?.map(exc => exc.text || exc) || existingTour.excludes || [],
            schedule: langTranslations.schedule || existingTour.itinerary?.map(item => ({
              time: item.time || '',
              title: item.title || '',
              description: item.description || ''
            })) || existingTour.schedule || [],
            faqs: langTranslations.faqs || existingTour.faqs || []
          };
        }
      });
      
      // 투어 업데이트
      const updateUrl = `/api/admin/tours/${existingTour.id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: headers,
        credentials: 'include',
        body: JSON.stringify(updateData)
      });
      
      const updateResult = await updateResponse.json();
      
      if (updateResponse.ok && updateResult.success) {
        console.log(`   ✅ 성공: ${existingTour.title}`);
        successCount++;
      } else {
        console.error(`   ❌ 실패: ${updateResult.error || updateResult.message || 'Unknown error'}`);
        console.error(`   응답:`, updateResult);
        errorCount++;
      }
      
    } catch (error) {
      console.error(`   ❌ 에러: ${error.message}`);
      console.error(error);
      errorCount++;
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('✅ 번역 적용 완료!');
  console.log(`   성공: ${successCount}개`);
  console.log(`   실패: ${errorCount}개`);
  console.log('='.repeat(80));
  console.log('');
  
  if (errorCount > 0) {
    console.log('⚠️  일부 투어 업데이트에 실패했습니다. 위의 에러 메시지를 확인하세요.');
  }
})();

