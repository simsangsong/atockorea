// Test Tour 삭제 스크립트
// 브라우저 콘솔에서 실행

(async () => {
  console.log('🗑️ Test Tour 삭제 중...\n');
  
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
    console.error('❌ 인증 토큰을 찾을 수 없습니다.');
    return;
  }
  
  // 방법 1: Test Tour ID로 직접 삭제 (이전 로그에서 본 ID)
  const testTourId = '62e8a136-a854-4dd7-a7b3-3cb6df13053e';
  
  // 방법 2: slug로 찾아서 삭제 (더 안전함)
  console.log('🔍 "Test Tour" 검색 중...');
  
  try {
    // 먼저 모든 투어 목록 가져오기
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
    
    // "Test Tour" 제목을 가진 투어 찾기
    const testTour = listResult.data.find((tour: any) => 
      tour.title === 'Test Tour' || 
      tour.title.toLowerCase().includes('test') ||
      tour.slug?.includes('test-tour')
    );
    
    if (!testTour) {
      console.log('✅ Test Tour를 찾을 수 없습니다. 이미 삭제되었거나 없습니다.');
      return;
    }
    
    console.log(`📋 찾은 투어:`);
    console.log(`   ID: ${testTour.id}`);
    console.log(`   제목: ${testTour.title}`);
    console.log(`   Slug: ${testTour.slug}\n`);
    
    // 삭제 확인
    const confirmed = confirm(`"${testTour.title}" 투어를 삭제하시겠습니까?`);
    if (!confirmed) {
      console.log('❌ 삭제가 취소되었습니다.');
      return;
    }
    
    // 삭제 실행
    console.log('🗑️ 삭제 중...');
    const deleteResponse = await fetch(`/api/tours/${testTour.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
    });
    
    const deleteResult = await deleteResponse.json();
    
    if (deleteResponse.ok && deleteResult.success) {
      console.log('✅ Test Tour가 성공적으로 삭제되었습니다!');
      alert('✅ Test Tour 삭제 완료!');
    } else {
      console.error('❌ 삭제 실패:', deleteResult.error || deleteResult);
      alert('❌ 삭제 실패: ' + (deleteResult.error || 'Unknown error'));
    }
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
  }
})();











