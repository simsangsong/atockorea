// ============================================
// translations 컬럼 존재 여부 확인 스크립트
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요

(async () => {
  console.log('🔍 translations 컬럼 확인 중...');
  console.log('');
  
  try {
    // 투어 하나 가져와서 translations 필드 확인
    const response = await fetch('/api/admin/tours', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const tours = data.data || [];
    
    if (tours.length === 0) {
      console.log('⚠️  투어가 없습니다.');
      return;
    }
    
    const firstTour = tours[0];
    
    console.log('📊 첫 번째 투어 확인:');
    console.log(`   ID: ${firstTour.id}`);
    console.log(`   제목: ${firstTour.title}`);
    console.log(`   translations 필드:`, firstTour.translations);
    console.log('');
    
    if (firstTour.translations === undefined) {
      console.log('❌ translations 컬럼이 없습니다!');
      console.log('');
      console.log('✅ 해결 방법:');
      console.log('   1. Supabase 대시보드 접속: https://supabase.com/dashboard');
      console.log('   2. SQL Editor 열기');
      console.log('   3. 다음 SQL 실행:');
      console.log('');
      console.log('   ALTER TABLE tours');
      console.log('   ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT \'{}\'::jsonb;');
      console.log('');
      console.log('   CREATE INDEX IF NOT EXISTS idx_tours_translations');
      console.log('   ON tours USING GIN (translations);');
      console.log('');
    } else {
      console.log('✅ translations 컬럼이 존재합니다!');
      console.log(`   현재 값: ${JSON.stringify(firstTour.translations)}`);
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    console.log('');
    console.log('💡 /admin에서 로그인했는지 확인하세요.');
  }
})();




