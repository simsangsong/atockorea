// ============================================
// 투어 수정 스크립트
// ============================================
// 브라우저 콘솔에서 실행
// 투어 ID 또는 slug로 투어를 찾아서 수정

(async () => {
  // ===== 설정: 수정할 투어 정보 =====
  const tourSlugOrId = 'jeju-southern-unesco-geopark-day-tour'; // slug 또는 ID
  // 또는: const tourSlugOrId = '62e8a136-a854-4dd7-a7b3-3cb6df13053e'; // 직접 ID 사용
  
  // ===== 수정할 데이터 (변경하고 싶은 필드만 포함) =====
  const updateData = {
    // 예시: 가격만 수정
    // price: 85000,
    
    // 예시: 제목 수정
    // title: "새로운 투어 제목",
    
    // 예시: 설명 수정
    // description: "새로운 설명...",
    
    // 예시: is_featured 변경
    // is_featured: true,
    
    // 예시: 여러 필드 동시 수정
    // price: 85000,
    // original_price: 100000,
    // is_featured: true,
  };
  
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
  
  try {
    console.log('🔍 투어 검색 중...');
    console.log(`📋 검색어: ${tourSlugOrId}\n`);
    
    // 1. 먼저 투어 찾기
    const listResponse = await fetch('/api/admin/tours', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
    });
    
    const listResult = await listResponse.json();
    
    if (!listResult.success || !listResult.data) {
      console.error('❌ 투어 목록을 가져올 수 없습니다.');
      return;
    }
    
    // slug 또는 ID로 투어 찾기
    const tour = listResult.data.find((t: any) => 
      t.id === tourSlugOrId || 
      t.slug === tourSlugOrId
    );
    
    if (!tour) {
      console.error('❌ 투어를 찾을 수 없습니다.');
      console.log('💡 사용 가능한 투어 목록:');
      listResult.data.forEach((t: any) => {
        console.log(`   - ${t.title} (ID: ${t.id}, slug: ${t.slug})`);
      });
      return;
    }
    
    console.log('✅ 투어 찾음!');
    console.log(`   제목: ${tour.title}`);
    console.log(`   ID: ${tour.id}`);
    console.log(`   Slug: ${tour.slug}`);
    console.log(`   현재 가격: ₩${tour.price.toLocaleString()}\n`);
    
    // 2. 수정할 데이터 확인
    if (Object.keys(updateData).length === 0) {
      console.log('⚠️ 수정할 데이터가 없습니다.');
      console.log('💡 updateData 객체에 수정할 필드를 추가하세요.');
      console.log('\n예시:');
      console.log('const updateData = {');
      console.log('  price: 85000,');
      console.log('  title: "새로운 제목",');
      console.log('  is_featured: true');
      console.log('};');
      return;
    }
    
    console.log('📝 수정할 데이터:');
    Object.entries(updateData).forEach(([key, value]) => {
      console.log(`   ${key}: ${JSON.stringify(value)}`);
    });
    console.log('');
    
    // 3. 수정 실행
    console.log('🔄 투어 수정 중...');
    const updateResponse = await fetch(`/api/tours/${tour.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    
    console.log(`응답 상태: ${updateResponse.status} ${updateResponse.statusText}\n`);
    
    const updateResult = await updateResponse.json();
    
    if (updateResponse.ok && updateResult.success) {
      console.log('✅ 투어 수정 성공!');
      console.log('📋 수정된 투어 정보:');
      console.log(`   ID: ${updateResult.data.id}`);
      console.log(`   제목: ${updateResult.data.title}`);
      if (updateData.price !== undefined) {
        console.log(`   가격: ₩${updateResult.data.price.toLocaleString()}`);
      }
      console.log('');
      console.log(`🌐 투어 확인: /tour/${updateResult.data.slug}`);
      alert('✅ 투어 수정 성공!');
      return updateResult.data;
    } else {
      console.error('❌ 투어 수정 실패');
      console.error('에러:', updateResult.error || updateResult);
      alert('❌ 수정 실패: ' + (updateResult.error || 'Unknown error'));
      throw new Error(updateResult.error || 'Failed to update tour');
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    throw error;
  }
})();

