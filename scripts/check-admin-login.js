// Admin 로그인 상태 확인 스크립트
// 브라우저 콘솔에서 실행하여 현재 로그인 상태 확인

(async () => {
  console.log('🔍 현재 로그인 상태 확인 중...\n');
  
  try {
    // 현재 쿠키 확인
    console.log('📋 쿠키 확인:');
    const cookies = document.cookie.split(';').map(c => c.trim());
    const authCookies = cookies.filter(c => c.toLowerCase().includes('auth'));
    if (authCookies.length > 0) {
      console.log('✅ 인증 쿠키 발견:', authCookies.length + '개');
      authCookies.forEach((cookie, i) => {
        const [name] = cookie.split('=');
        console.log(`   ${i + 1}. ${name.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ 인증 쿠키를 찾을 수 없습니다.');
    }
    console.log('');
    
    // API로 현재 사용자 정보 확인
    console.log('🔐 사용자 정보 확인 중...');
    const response = await fetch('/api/admin/tours', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    
    const result = await response.json();
    
    if (response.status === 200 && result.success) {
      console.log('✅ Admin 권한 확인됨!');
      console.log('✅ 투어 추가 API 사용 가능합니다.\n');
      console.log('💡 다음 단계: add-tour-browser-safe.js 실행');
      return true;
    } else if (response.status === 401) {
      console.log('❌ 인증되지 않았습니다.');
      console.log('');
      console.log('📝 해결 방법:');
      console.log('   1. /admin 또는 /signin 페이지로 이동');
      console.log('   2. Admin 계정으로 로그인');
      console.log('   3. 이 스크립트를 다시 실행하여 확인');
      return false;
    } else if (response.status === 403) {
      console.log('❌ 권한이 없습니다 (Admin이 아님).');
      console.log('');
      console.log('📝 해결 방법:');
      console.log('   1. Supabase SQL Editor에서 Admin 역할 확인:');
      console.log('      SELECT id, email, role FROM user_profiles WHERE email = \'your-email@example.com\';');
      console.log('');
      console.log('   2. Admin 역할이 아니면 설정:');
      console.log('      UPDATE user_profiles SET role = \'admin\' WHERE email = \'your-email@example.com\';');
      console.log('');
      console.log('   3. 로그아웃 후 다시 로그인');
      return false;
    } else {
      console.log('⚠️ 예상치 못한 응답:', response.status);
      console.log('응답:', result);
      return false;
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    return false;
  }
})();











