// ============================================
// 모든 투어 텍스트 추출 스크립트 (번역용)
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요
// 현재 데이터베이스에 있는 모든 투어의 텍스트를 추출하여
// 기존 .js 파일 형식으로 출력합니다.
//
// 사용 방법:
// 1. http://localhost:3000 또는 프로덕션 사이트 접속
// 2. 브라우저 콘솔(F12) 열기
// 3. 이 스크립트를 복사해서 붙여넣고 실행
// 4. 콘솔에 출력된 JavaScript 코드를 복사하여 파일로 저장
// 5. ChatGPT에서 번역 후 다시 적용

(async () => {
  console.log('🚀 투어 데이터 추출 시작...');
  console.log('');
  
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
    console.warn('⚠️  인증 토큰을 찾을 수 없습니다. /admin에서 로그인하세요.');
    console.warn('   Admin API를 사용하려면 로그인이 필요합니다. 계속 진행합니다...');
  }
  
  try {
    // Admin API로 모든 투어 가져오기 (pickup_points 포함)
    console.log('📡 Admin API로 모든 투어 가져오는 중...');
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Authorization 헤더 추가
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const adminResponse = await fetch('/api/admin/tours', {
      method: 'GET',
      headers: headers,
      credentials: 'include'
    });
    
    if (!adminResponse.ok) {
      if (adminResponse.status === 403 || adminResponse.status === 401) {
        throw new Error('Admin 권한이 필요합니다. /admin에서 로그인하세요.');
      }
      throw new Error(`API 요청 실패: ${adminResponse.status} ${adminResponse.statusText}`);
    }
    
    const adminResult = await adminResponse.json();
    const toursRaw = adminResult.data || [];
    
    if (toursRaw.length === 0) {
      console.log('❌ 투어를 찾을 수 없습니다.');
      return;
    }
    
    console.log(`✅ ${toursRaw.length}개의 투어를 찾았습니다.`);
    console.log('');
    
    // Admin API에서 받은 데이터를 프론트엔드 형식으로 변환
    const tours = toursRaw.map(tour => ({
      id: tour.id,
      title: tour.title,
      slug: tour.slug,
      city: tour.city,
      tag: tour.tag,
      subtitle: tour.subtitle,
      tagline: tour.subtitle || tour.tagline,
      location: tour.location || tour.city,
      description: tour.description,
      overview: tour.description,
      highlight: tour.highlight,
      difficulty: tour.difficulty,
      groupSize: tour.group_size,
      badges: tour.badges || [],
      price: parseFloat(tour.price),
      originalPrice: tour.original_price ? parseFloat(tour.original_price) : null,
      priceType: tour.price_type,
      duration: tour.duration,
      lunchIncluded: tour.lunch_included,
      ticketIncluded: tour.ticket_included,
      pickupInfo: tour.pickup_info,
      notes: tour.notes,
      highlights: tour.highlights || [],
      includes: tour.includes || [],
      excludes: tour.excludes || [],
      schedule: tour.schedule || [],
      itinerary: tour.schedule || [],
      faqs: tour.faqs || [],
      pickupPoints: (tour.pickup_points || []).map((pp) => ({
        id: pp.id,
        name: pp.name,
        address: pp.address,
        lat: pp.lat ? parseFloat(pp.lat) : 0,
        lng: pp.lng ? parseFloat(pp.lng) : 0,
        pickup_time: pp.pickup_time
      })),
      images: tour.gallery_images || [],
      rating: tour.rating ? parseFloat(tour.rating) : 0,
      reviewCount: tour.review_count || 0,
      pickupPointsCount: tour.pickup_points_count || 0,
      dropoffPointsCount: tour.dropoff_points_count || 0,
      isActive: tour.is_active,
      isFeatured: tour.is_featured,
      quickFacts: tour.quickFacts || []
    }));
    
    console.log('');
    console.log('='.repeat(80));
    console.log('📋 추출된 투어 데이터 (번역용)');
    console.log('='.repeat(80));
    console.log('');
    
    // 각 투어에 대해 개별 파일로 출력
    tours.forEach((tour, index) => {
      const tourFileName = (tour.slug || `tour-${index + 1}`).replace(/[^a-z0-9-]/gi, '-');
      
      console.log(`// ============================================`);
      console.log(`// Tour ${index + 1}/${tours.length}: ${tour.title || 'Untitled'}`);
      console.log(`// ============================================`);
      console.log(`// 파일명: add-${tourFileName}.js`);
      console.log(`// Slug: ${tour.slug || 'N/A'}`);
      console.log(`// City: ${tour.city || 'N/A'}`);
      console.log(`// ID: ${tour.id || 'N/A'}`);
      console.log('');
      
      // tourData 객체 생성 (기존 .js 파일 형식과 동일하게)
      const tourData = {
        // ===== 필수 필드 =====
        title: tour.title || '',
        slug: tour.slug || '',
        city: tour.city || '',
        price: tour.price || 0,
        price_type: tour.priceType || 'person',
        image_url: (tour.images && tour.images.length > 0) ? tour.images[0].url : '',
        
        // ===== 선택 필드 =====
        tag: tour.tag || null,
        subtitle: tour.subtitle || null,
        tagline: tour.tagline || null, // 상세 페이지용
        location: tour.location || null, // 세부 위치
        description: tour.overview || tour.description || '',
        highlight: tour.highlight || null, // 하이라이트
        original_price: tour.originalPrice || null,
        duration: tour.duration || null,
        difficulty: tour.difficulty || null, // 난이도
        groupSize: tour.groupSize || null, // 그룹 크기
        badges: Array.isArray(tour.badges) ? tour.badges : [], // 배지
        lunch_included: tour.lunchIncluded !== undefined ? tour.lunchIncluded : false,
        ticket_included: tour.ticketIncluded !== undefined ? tour.ticketIncluded : false,
        
        gallery_images: (tour.images && Array.isArray(tour.images)) 
          ? tour.images.map(img => img.url || img)
          : [],
        
        pickup_info: tour.pickupInfo || null,
        notes: tour.notes || null,
        
        highlights: Array.isArray(tour.highlights) ? tour.highlights : [],
        includes: Array.isArray(tour.inclusions) 
          ? tour.inclusions.map(inc => inc.text || inc)
          : (Array.isArray(tour.includes) ? tour.includes : []),
        excludes: Array.isArray(tour.exclusions)
          ? tour.exclusions.map(exc => exc.text || exc)
          : (Array.isArray(tour.excludes) ? tour.excludes : []),
        schedule: Array.isArray(tour.itinerary)
          ? tour.itinerary.map(item => ({
              time: item.time || '',
              title: item.title || '',
              description: item.description || ''
            }))
          : (Array.isArray(tour.schedule) ? tour.schedule : []),
        faqs: Array.isArray(tour.faqs) ? tour.faqs : [],
        quickFacts: Array.isArray(tour.quickFacts) ? tour.quickFacts : [], // 빠른 정보
        
        rating: tour.rating || 0,
        review_count: tour.reviewCount || 0,
        pickup_points_count: tour.pickupPoints ? tour.pickupPoints.length : 0,
        dropoff_points_count: tour.dropoffPointsCount || 0,
        is_active: tour.isActive !== undefined ? tour.isActive : true,
        is_featured: tour.isFeatured || false
      };
      
      // pickup_points 추가
      if (Array.isArray(tour.pickupPoints) && tour.pickupPoints.length > 0) {
        tourData.pickup_points = tour.pickupPoints.map(pp => ({
          name: pp.name || '',
          address: pp.address || '',
          lat: pp.lat || 0,
          lng: pp.lng || 0,
          pickup_time: pp.pickup_time || null
        }));
      }
      
      // JavaScript 코드로 출력 (기존 .js 파일 형식)
      console.log('const tourData = ' + JSON.stringify(tourData, null, 2) + ';');
      console.log('');
      console.log('// ============================================');
      console.log('// 위 tourData를 사용하여 번역 후 업데이트하는 방법:');
      console.log('// scripts/update-tour-with-translations.js 파일을 참고하세요');
      console.log('// ============================================');
      console.log('');
      console.log('='.repeat(80));
      console.log('');
    });
    
    // ============================================
    // 각 투어를 개별 JSON 객체로 출력 (하나씩 번역 가능)
    // ============================================
    console.log('');
    console.log('='.repeat(100));
    console.log('📋 투어 데이터 추출 완료 - 각 투어를 개별적으로 번역하세요');
    console.log('='.repeat(100));
    console.log('');
    console.log(`총 ${tours.length}개의 투어가 추출되었습니다.`);
    console.log('각 투어를 하나씩 복사해서 ChatGPT에 번역 요청하세요.\n');
    
    tours.forEach((tour, index) => {
      const description = tour.overview || tour.description || '';
      const pickupInfo = tour.pickupInfo || '';
      const notes = tour.notes || '';
      
      // 각 투어별로 JSON 객체 생성
      const tourTextData = {
        tour_number: index + 1,
        total_tours: tours.length,
        id: tour.id || '',
        slug: tour.slug || '',
        title: tour.title || '',
        subtitle: tour.subtitle || null,
        tagline: tour.tagline || null,
        tag: tour.tag || null,
        city: tour.city || '',
        location: tour.location || null,
        highlight: tour.highlight || null,
        description: description,
        highlights: Array.isArray(tour.highlights) ? tour.highlights : [],
        includes: Array.isArray(tour.inclusions)
          ? tour.inclusions.map(inc => typeof inc === 'string' ? inc : (inc.text || inc))
          : (Array.isArray(tour.includes) ? tour.includes : []),
        excludes: Array.isArray(tour.exclusions)
          ? tour.exclusions.map(exc => typeof exc === 'string' ? exc : (exc.text || exc))
          : (Array.isArray(tour.excludes) ? tour.excludes : []),
        schedule: (Array.isArray(tour.itinerary) ? tour.itinerary : (Array.isArray(tour.schedule) ? tour.schedule : [])).map(item => ({
          time: item.time || '',
          title: item.title || '',
          description: item.description || ''
        })),
        pickup_info: pickupInfo || null,
        pickup_points: Array.isArray(tour.pickupPoints) && tour.pickupPoints.length > 0
          ? tour.pickupPoints.map(pp => ({
              name: pp.name || '',
              address: pp.address || '',
              pickup_time: pp.pickup_time || null
            }))
          : [],
        notes: notes || null,
        faqs: Array.isArray(tour.faqs) ? tour.faqs : [],
        difficulty: tour.difficulty || null,
        groupSize: tour.groupSize || null,
        badges: Array.isArray(tour.badges) ? tour.badges : [],
        quickFacts: Array.isArray(tour.quickFacts) ? tour.quickFacts : []
      };
      
      console.log('─'.repeat(100));
      console.log(`투어 ${index + 1}/${tours.length}: ${tour.title || 'Untitled'}`);
      console.log(`ID: ${tour.id || 'N/A'} | Slug: ${tour.slug || 'N/A'}`);
      console.log('─'.repeat(100));
      console.log('');
      console.log('// 아래 JSON을 복사해서 ChatGPT에 붙여넣고 번역 요청하세요:');
      console.log('// "이 JSON의 모든 텍스트 필드를 영어, 중국어 간체, 중국어 번체, 한국어, 일본어, 스페인어로 번역해줘. 번역된 내용은 동일한 JSON 구조로 반환하고, 각 언어별로 translations 객체에 담아줘."');
      console.log('');
      console.log(JSON.stringify(tourTextData, null, 2));
      console.log('');
      console.log('');
    });
    
    console.log('='.repeat(100));
    console.log('');
    console.log('✅ 모든 투어 추출 완료!');
    console.log('');
    console.log('💡 사용 방법:');
    console.log('   1. 위의 각 투어별 JSON을 하나씩 복사');
    console.log('   2. ChatGPT에 붙여넣고 다음을 요청:');
    console.log('      "이 JSON의 모든 텍스트 필드를 영어, 중국어 간체, 중국어 번체, 한국어, 일본어, 스페인어로 번역해줘.');
    console.log('       번역된 내용은 동일한 JSON 구조로 반환하고, 각 언어별로 translations 객체를 추가해줘.');
    console.log('       형식: { id: "...", slug: "...", translations: { en: {...}, zh: {...}, "zh-TW": {...}, ko: {...}, ja: {...}, es: {...} } }"');
    console.log('   3. 번역된 JSON을 받아서 scripts/update-all-tours-translations.js의 translatedTours 배열에 추가');
    console.log('   4. 모든 투어를 번역할 때까지 1-3 단계를 반복');
    console.log('');
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    console.error(error.stack);
  }
})();

