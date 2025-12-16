// 스크립트: 제주 프라이빗 차량 투어 업데이트 (제목/설명 변경 + 15% 할인)
// 브라우저 콘솔에서 실행하세요.

(async () => {
  console.log('🚀 제주 프라이빗 차량 투어 업데이트 시작...');
  
  // localStorage에서 인증 토큰 가져오기
  let accessToken = null;
  
  // localStorage의 모든 키 확인
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('auth-token')) {
      try {
        const tokenData = JSON.parse(localStorage.getItem(key) || '{}');
        if (tokenData.access_token) {
          accessToken = tokenData.access_token;
          console.log('✅ 토큰 찾음:', key.substring(0, 20) + '...');
          break;
        }
      } catch (e) {
        // JSON 파싱 실패, 다음 키 확인
      }
    }
  }
  
  if (!accessToken) {
    console.error('❌ 인증 토큰을 찾을 수 없습니다. 먼저 로그인해주세요.');
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
  
  // 1. 먼저 제주 프라이빗 투어를 찾기
  console.log('🔍 제주 프라이빗 투어 검색 중...');
  
  const searchResponse = await fetch('/api/tours?city=Jeju&search=private', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    credentials: 'include',
  });
  
  if (!searchResponse.ok) {
    console.error('❌ 투어 검색 실패:', searchResponse.status, await searchResponse.text());
    return;
  }
  
  const searchData = await searchResponse.json();
  const tours = searchData.tours || searchData.data || [];
  
  console.log(`📋 찾은 제주 투어 수: ${tours.length}`);
  
  // 제목에 "private", "car", "charter", "driver" 등이 포함된 투어 찾기
  const targetTour = tours.find(tour => {
    const titleLower = (tour.title || '').toLowerCase();
    return titleLower.includes('private') && 
           (titleLower.includes('car') || titleLower.includes('charter') || titleLower.includes('driver'));
  });
  
  if (!targetTour) {
    console.error('❌ 제주 프라이빗 차량 투어를 찾을 수 없습니다.');
    console.log('📋 사용 가능한 제주 투어 목록:');
    tours.forEach(t => console.log(`  - ${t.title} (${t.slug}) - ₩${t.price}`));
    return;
  }
  
  console.log('✅ 찾은 투어:', targetTour.title);
  console.log('  Slug:', targetTour.slug);
  console.log('  현재 가격:', `₩${targetTour.price}`);
  console.log('  원래 가격:', targetTour.original_price ? `₩${targetTour.original_price}` : '없음');
  
  // 2. 가격 계산 (15% 할인)
  const currentPrice = parseFloat(targetTour.price) || 0;
  const originalPrice = parseFloat(targetTour.original_price) || currentPrice;
  
  // original_price가 없으면 현재 가격을 original_price로 설정
  const newOriginalPrice = originalPrice || currentPrice;
  const newPrice = Math.round(newOriginalPrice * 0.85); // 15% 할인
  
  console.log(`💰 가격 계산:`);
  console.log(`  원래 가격: ₩${newOriginalPrice}`);
  console.log(`  할인 가격 (15% 할인): ₩${newPrice}`);
  
  // 3. 제목과 설명 변경
  const newTitle = "제주 프라이빗 맞춤형 차량 투어";
  const newDescription = "제주도의 인기 명소를 프라이빗하게 탐험하세요. 경험이 풍부한 드라이버 가이드를 통해 나만의 일정을 설계하고 가장 관심 있는 장소를 방문할 수 있습니다.";
  
  const updateData = {
    title: newTitle,
    description: newDescription,
    price: newPrice,
    original_price: newOriginalPrice,
  };
  
  console.log('📝 업데이트 데이터:');
  console.log('  제목:', newTitle);
  console.log('  설명:', newDescription);
  console.log('  가격:', `₩${newPrice}`);
  console.log('  원래 가격:', `₩${newOriginalPrice}`);
  
  // 4. 투어 업데이트
  console.log('🔄 투어 업데이트 중...');
  
  const updateResponse = await fetch(`/api/tours/${targetTour.id}`, {
    method: 'PATCH',
    headers: headers,
    credentials: 'include',
    body: JSON.stringify(updateData),
  });
  
  if (!updateResponse.ok) {
    const errorData = await updateResponse.json();
    console.error('❌ 업데이트 실패:', updateResponse.status, errorData);
    return;
  }
  
  const updatedTour = await updateResponse.json();
  
  console.log('✅ 업데이트 완료!');
  console.log('📦 업데이트된 투어:', updatedTour.data || updatedTour);
  console.log('');
  console.log('🎉 제목, 설명, 가격이 성공적으로 업데이트되었습니다!');
})();
