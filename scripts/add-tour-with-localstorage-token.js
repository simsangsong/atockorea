// localStorage에서 토큰을 읽어서 Authorization 헤더로 전달하는 버전
// 브라우저 콘솔에서 실행

(async () => {
  const tourData = {
    // ===== 필수 필드 =====
    title: "Jeju Island: Full Day Tour for Cruise Ship Passengers",
    slug: "jeju-island-full-day-tour-cruise-passengers-" + Date.now(), // 고유성 보장
    city: "Jeju",
    price: 88000,
    price_type: "person",
    image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
    
    // ===== 선택 필드 =====
    tag: "Cruise",
    subtitle: "Top rated",
    description: "Exclusive Jeju tour for cruise guests. Pickup & drop-off strictly on time at the cruise terminal. Two itineraries are available for Jeju's two ports, with full details in the description.",
    original_price: 88000,
    duration: "8 hours",
    lunch_included: false,
    ticket_included: true,
    is_active: true,
    is_featured: true
  };
  
  try {
    console.log('🚀 투어 추가 시작...');
    console.log(`📦 투어 제목: ${tourData.title}`);
    console.log(`🏷️  Slug: ${tourData.slug}\n`);
    
    // localStorage에서 인증 토큰 가져오기
    console.log('🔍 localStorage에서 인증 토큰 찾는 중...');
    let accessToken = null;
    
    // 방법 1: Supabase 프로젝트 ref로 직접 찾기
    const supabaseProjectRefs = [
      'sb-cghyvbwmijgpahnoduyv-auth-token', // 프로젝트 ref (환경에 맞게 수정 필요)
      'sb-cghyvbwmijqpahnoduyv-auth-token', // 대안
    ];
    
    for (const key of supabaseProjectRefs) {
      try {
        const authData = localStorage.getItem(key);
        if (authData) {
          const parsed = JSON.parse(authData);
          accessToken = parsed?.access_token || parsed?.accessToken || parsed?.session?.access_token;
          if (accessToken) {
            console.log(`✅ 토큰 발견: ${key}`);
            break;
          }
        }
      } catch (e) {
        // Skip
      }
    }
    
    // 방법 2: 모든 localStorage 키에서 auth-token 찾기 (fallback)
    if (!accessToken) {
      console.log('🔍 모든 localStorage 키 검색 중...');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('auth-token') || key.includes('supabase'))) {
          try {
            const authData = localStorage.getItem(key);
            const parsed = JSON.parse(authData);
            accessToken = parsed?.access_token || parsed?.accessToken || parsed?.session?.access_token;
            if (accessToken) {
              console.log(`✅ 토큰 발견 (fallback): ${key}`);
              break;
            }
          } catch (e) {
            // Skip
          }
        }
      }
    }
    
    if (!accessToken) {
      console.error('❌ 인증 토큰을 찾을 수 없습니다.');
      console.log('\n💡 해결 방법:');
      console.log('   1. /admin 페이지에서 로그아웃 후 다시 로그인');
      console.log('   2. 브라우저 개발자 도구 → Application → Local Storage 확인');
      console.log('   3. sb-*-auth-token 키가 있는지 확인');
      throw new Error('No access token found in localStorage');
    }
    
    // 헤더 준비
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`, // 토큰을 헤더에 추가
    };
    
    console.log('✅ Authorization 헤더 설정 완료\n');
    console.log('📡 API 호출 중...');
    
    // API 호출
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: headers,
      credentials: 'include', // 쿠키도 함께 전송
      body: JSON.stringify(tourData)
    });
    
    console.log(`응답 상태: ${response.status} ${response.statusText}\n`);
    
    const result = await response.json();
    
    if (result.data) {
      console.log('✅ 투어 생성 성공!');
      console.log('📋 생성된 투어 정보:');
      console.log(`   ID: ${result.data.id}`);
      console.log(`   제목: ${result.data.title}`);
      console.log(`   Slug: ${result.data.slug}`);
      console.log(`   가격: ₩${result.data.price.toLocaleString()}`);
      console.log(`   도시: ${result.data.city}`);
      console.log('');
      console.log(`🌐 투어 확인: /tour/${result.data.slug}`);
      alert('✅ 투어 생성 성공!\n\n투어 ID: ' + result.data.id + '\n제목: ' + result.data.title);
      return result.data;
    } else {
      console.error('❌ 투어 생성 실패');
      console.error('에러:', result.error);
      console.error('전체 응답:', result);
      alert('❌ 투어 생성 실패: ' + (result.error || 'Unknown error'));
      throw new Error(result.error || 'Failed to create tour');
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    throw error;
  }
})();
