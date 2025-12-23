// 인증 디버깅 스크립트
// 브라우저 콘솔에서 실행하여 인증 상태를 자세히 확인

(async () => {
  console.log('🔍 인증 상태 상세 디버깅\n');
  console.log('='.repeat(60));
  
  // 1. 쿠키 확인
  console.log('\n📋 1. 쿠키 확인');
  console.log('-'.repeat(60));
  const allCookies = document.cookie.split(';').map(c => c.trim());
  console.log(`전체 쿠키 개수: ${allCookies.length}`);
  
  const supabaseCookies = allCookies.filter(c => 
    c.toLowerCase().includes('auth') || 
    c.toLowerCase().includes('supabase') ||
    c.toLowerCase().includes('sb-')
  );
  
  console.log(`인증 관련 쿠키: ${supabaseCookies.length}개`);
  supabaseCookies.forEach((cookie, i) => {
    const [name, value] = cookie.split('=');
    const nameDecoded = decodeURIComponent(name);
    const valuePreview = value ? value.substring(0, 50) + '...' : '(empty)';
    console.log(`  ${i + 1}. ${nameDecoded}: ${valuePreview}`);
  });
  
  // 2. localStorage 확인
  console.log('\n💾 2. localStorage 확인');
  console.log('-'.repeat(60));
  const localStorageKeys = Object.keys(localStorage).filter(k => 
    k.includes('auth') || k.includes('supabase') || k.includes('sb-')
  );
  console.log(`인증 관련 localStorage 키: ${localStorageKeys.length}개`);
  localStorageKeys.forEach((key, i) => {
    const value = localStorage.getItem(key);
    const preview = value ? value.substring(0, 100) + '...' : '(empty)';
    console.log(`  ${i + 1}. ${key}: ${preview}`);
  });
  
  // 3. sessionStorage 확인
  console.log('\n🗄️ 3. sessionStorage 확인');
  console.log('-'.repeat(60));
  const sessionStorageKeys = Object.keys(sessionStorage).filter(k => 
    k.includes('auth') || k.includes('supabase') || k.includes('sb-')
  );
  console.log(`인증 관련 sessionStorage 키: ${sessionStorageKeys.length}개`);
  sessionStorageKeys.forEach((key, i) => {
    const value = sessionStorage.getItem(key);
    const preview = value ? value.substring(0, 100) + '...' : '(empty)';
    console.log(`  ${i + 1}. ${key}: ${preview}`);
  });
  
  // 4. API 테스트 (GET - 읽기 전용)
  console.log('\n🔐 4. API 인증 테스트');
  console.log('-'.repeat(60));
  
  try {
    console.log('GET /api/admin/tours 호출 중...');
    const response = await fetch('/api/admin/tours', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    console.log(`응답 상태: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    if (response.status === 200) {
      console.log('✅ 인증 성공! Admin 권한 확인됨.');
      console.log(`투어 개수: ${result.data?.length || 0}개`);
    } else if (response.status === 401) {
      console.log('❌ 401 Unauthorized: 인증되지 않음');
      console.log('응답:', result);
      console.log('\n💡 해결 방법:');
      console.log('   1. /admin 페이지에서 로그아웃 후 다시 로그인');
      console.log('   2. 브라우저 캐시 및 쿠키 삭제 후 다시 시도');
      console.log('   3. 시크릿 모드에서 /admin 로그인 후 다시 시도');
    } else if (response.status === 403) {
      console.log('❌ 403 Forbidden: Admin 권한 없음');
      console.log('응답:', result);
      console.log('\n💡 해결 방법:');
      console.log('   1. Supabase SQL Editor에서 role 확인:');
      console.log('      SELECT id, email, role FROM user_profiles WHERE email = \'admin@atockorea.com\';');
      console.log('   2. Admin 역할이 아니면 설정:');
      console.log('      UPDATE user_profiles SET role = \'admin\' WHERE email = \'admin@atockorea.com\';');
    } else {
      console.log(`⚠️ 예상치 못한 응답: ${response.status}`);
      console.log('응답:', result);
    }
  } catch (error) {
    console.error('❌ 네트워크 에러:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('디버깅 완료');
})();


