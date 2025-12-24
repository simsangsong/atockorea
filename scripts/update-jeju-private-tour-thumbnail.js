// ============================================
// Update Jeju Private Car Charter Tour - Thumbnail
// ============================================
// This script updates the thumbnail image for the private tour
// Run this in browser console after logging in as admin

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
  
  // 5번째 사진: 검은색 미니밴이 해안 도로를 달리는 사진 (썸네일)
  // 사용자가 업로드한 이미지 경로로 설정 필요
  const thumbnailImage = ""; // 5번째 사진의 실제 경로로 설정하세요 (예: "/images/tours/jeju-private-tour-minivan-coastal-road.jpg")
  
  if (!thumbnailImage) {
    console.error('❌ 썸네일 이미지 경로를 설정해주세요.');
    console.log('📝 사용법:');
    console.log('   1. 5번째 사진(검은색 미니밴이 해안 도로를 달리는 사진)을 업로드하세요');
    console.log('   2. 업로드한 이미지 경로를 확인하세요');
    console.log('   3. 이 스크립트의 thumbnailImage 변수에 경로를 입력하세요');
    console.log('   4. 스크립트를 다시 실행하세요');
    return;
  }
  
  // 1. 먼저 기존 프라이빗 투어 찾기
  console.log('🔍 기존 프라이빗 투어 검색 중...');
  
  const searchResponse = await fetch('/api/tours?city=Jeju&search=private', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    credentials: 'include',
  });
  
  if (!searchResponse.ok) {
    console.error('❌ 투어 검색 실패:', searchResponse.status);
    return;
  }
  
  const searchData = await searchResponse.json();
  const tours = searchData.tours || searchData.data || [];
  
  // "Jeju Island: Private Car Charter Tour" 제목으로 찾기
  const targetTour = tours.find(tour => 
    tour.title && tour.title.includes('Private Car Charter Tour')
  );
  
  if (!targetTour) {
    console.error('❌ 프라이빗 투어를 찾을 수 없습니다.');
    console.log('📋 사용 가능한 제주 투어 목록:');
    tours.forEach(t => console.log(`  - ${t.title} (${t.slug})`));
    return;
  }
  
  console.log('✅ 찾은 투어:', targetTour.title);
  console.log('  ID:', targetTour.id);
  console.log('  Slug:', targetTour.slug);
  console.log('  현재 썸네일:', targetTour.image_url);
  
  // 2. 업데이트 데이터 준비
  const updateData = {
    image_url: thumbnailImage, // 6번째 사진을 썸네일로 설정
  };
  
  console.log('📝 업데이트 데이터:');
  console.log('  새 썸네일 (5번째 사진):', updateData.image_url);
  
  // 3. 투어 업데이트
  console.log('🔄 투어 썸네일 업데이트 중...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  const updateResponse = await fetch(`/api/tours/${targetTour.id}`, {
    method: 'PATCH',
    headers: headers,
    credentials: 'include',
    body: JSON.stringify(updateData)
  });
  
  const result = await updateResponse.json();
  
  console.log('📡 응답 상태:', updateResponse.status, updateResponse.statusText);
  
  if (!updateResponse.ok) {
    console.error('❌ 투어 업데이트 실패');
    console.error('에러:', result.error || result.message);
    console.error('전체 응답:', result);
    throw new Error(result.error || '투어 업데이트 실패');
  }
  
  console.log('✅ 투어 썸네일 업데이트 성공!');
  console.log('📋 업데이트된 투어 정보:', result.data || result);
  console.log('🔗 투어 링크:', `/tour/${targetTour.slug || targetTour.id}`);
  console.log('📸 새 썸네일:', thumbnailImage);
  
  return result.data || result;
})();

