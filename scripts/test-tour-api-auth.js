// API 인증 테스트 스크립트
// 브라우저 콘솔에서 실행하세요

(async () => {
  console.log('🔍 API 인증 테스트 시작...\n');
  
  // 1. 현재 쿠키 확인
  console.log('1️⃣ 현재 쿠키:');
  console.log(document.cookie.split(';').map(c => c.trim()).slice(0, 5));
  console.log('');
  
  // 2. 간단한 테스트 요청 (최소 데이터)
  const testData = {
    title: "Test Tour",
    slug: "test-tour-" + Date.now(),
    city: "Seoul",
    price: 10000,
    price_type: "person",
    image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80"
  };
  
  console.log('2️⃣ 테스트 데이터:', testData);
  console.log('');
  
  try {
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(testData)
    });
    
    console.log('3️⃣ 응답 상태:', response.status, response.statusText);
    
    const result = await response.json();
    console.log('4️⃣ 응답 본문:', result);
    console.log('');
    
    if (response.status === 401) {
      console.error('❌ 인증 실패: 로그인이 필요합니다.');
      console.log('💡 해결 방법: /admin 페이지에서 먼저 로그인하세요.');
    } else if (response.status === 403) {
      console.error('❌ 권한 없음: admin role이 필요합니다.');
      console.log('💡 해결 방법: admin 계정으로 로그인하거나 user_profiles 테이블에서 role을 "admin"으로 설정하세요.');
    } else if (response.status === 201) {
      console.log('✅ 성공! API 인증이 정상적으로 작동합니다.');
    } else {
      console.error('❌ 예상치 못한 에러:', result);
    }
    
  } catch (error) {
    console.error('❌ 네트워크 에러:', error);
  }
})();
