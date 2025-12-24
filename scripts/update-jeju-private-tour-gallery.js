// ============================================
// Update Jeju Private Car Charter Tour - Gallery Images
// ============================================
// This script updates the gallery images for the private tour
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
  
  // 갤러리 이미지 설정 (5번째 사진 제외한 나머지)
  // 1번: 해녀 문화 행사 사진
  // 2번: 다이버/해녀 사진 (물속)
  // 3번: 감귤밭 창문 사진
  // 4번: 눈 덮인 풍경에서 말 타는 사진
  // 5번: 검은색 미니밴이 해안 도로를 달리는 사진 (썸네일로 사용, 갤러리 제외)
  // 6번: 해변 풍경 사진
  
  const galleryImages = [
    "", // 1번: 해녀 문화 행사 사진 경로 입력
    "", // 2번: 다이버/해녀 사진 경로 입력
    "", // 3번: 감귤밭 창문 사진 경로 입력
    "", // 4번: 눈 덮인 풍경에서 말 타는 사진 경로 입력
    ""  // 6번: 해변 풍경 사진 경로 입력
  ].filter(img => img !== ""); // 빈 문자열 제거
  
  if (galleryImages.length === 0) {
    console.error('❌ 갤러리 이미지 경로를 설정해주세요.');
    console.log('📝 사용법:');
    console.log('   1. 나머지 사진들(1-5번, 7-8번)을 업로드하세요');
    console.log('   2. 업로드한 이미지 경로를 확인하세요');
    console.log('   3. 이 스크립트의 galleryImages 배열에 경로를 입력하세요');
    console.log('   4. 스크립트를 다시 실행하세요');
    console.log('');
    console.log('📸 갤러리에 추가할 사진:');
    console.log('   - 1번: 해녀 문화 행사 사진');
    console.log('   - 2번: 다이버/해녀 사진 (물속)');
    console.log('   - 3번: 감귤밭 창문 사진');
    console.log('   - 4번: 눈 덮인 풍경에서 말 타는 사진');
    console.log('   - 6번: 해변 풍경 사진');
    console.log('   (5번 사진은 썸네일로 사용되므로 갤러리에서 제외)');
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
  console.log('  현재 갤러리 이미지 개수:', (targetTour.gallery_images || []).length);
  
  // 2. 업데이트 데이터 준비
  const updateData = {
    gallery_images: galleryImages, // 나머지 사진들을 갤러리에 추가
  };
  
  console.log('📝 업데이트 데이터:');
  console.log('  갤러리 이미지 개수:', galleryImages.length);
  console.log('  갤러리 이미지 목록:');
  galleryImages.forEach((img, index) => {
    console.log(`    ${index + 1}. ${img}`);
  });
  
  // 3. 투어 업데이트
  console.log('🔄 투어 갤러리 이미지 업데이트 중...');
  
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
  
  console.log('✅ 투어 갤러리 이미지 업데이트 성공!');
  console.log('📋 업데이트된 투어 정보:', result.data || result);
  console.log('🔗 투어 링크:', `/tour/${targetTour.slug || targetTour.id}`);
  console.log('📸 갤러리 이미지 개수:', galleryImages.length);
  
  return result.data || result;
})();

