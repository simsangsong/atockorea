// ============================================
// 5개 투어 이름 및 설명 간소화 업데이트 스크립트
// ============================================
// 브라우저 콘솔에서 실행
// 투어 이름과 설명을 간소화하고 원본과 다르게 변경

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
  
  // 업데이트할 투어 목록
  const tourUpdates = [
    {
      slug: 'jeju-southern-unesco-geopark-day-tour',
      updates: {
        title: "제주 남부 유네스코 지질공원 투어",
        description: "제주 남부의 유네스코 지질공원을 편안한 버스 투어로 탐방하세요. 한라산, 오설록 차 박물관, 주상절리대, 천지연폭포를 방문합니다. 모든 입장권과 가이드가 포함되어 있습니다."
      }
    },
    {
      slug: 'jeju-island-full-day-tour-cruise-passengers',
      updates: {
        title: "제주 크루즈 승객 전용 일일 투어",
        description: "크루즈 여행객을 위한 특별 투어. 크루즈 일정에 맞춘 맞춤형 스케줄. 제주 두 항구에 따라 다른 코스가 제공됩니다. 정시 픽업과 하차가 보장됩니다."
      }
    },
    {
      slug: 'jeju-eastern-unesco-spots-bus-tour',
      updates: {
        title: "제주 동부 유네스코 명소 버스 투어",
        description: "제주 동부와 북부의 유네스코 명소를 둘러보세요. 해녀 문화와 미천굴을 체험합니다. 제주 최대 섬의 자연과 문화를 한 번에 만나보세요."
      }
    },
    {
      slug: 'jeju-west-south-full-day-bus-tour',
      updates: {
        title: "제주 서부&남부 올데이 버스 투어",
        description: "제주 서부와 남부를 하루에 둘러보는 투어. 산책로, 녹차밭, 지역 체험, 해안 폭포를 즐기며 제주의 자연과 문화를 경험하세요."
      }
    },
    {
      slug: 'busan-top-attractions-authentic-one-day-tour',
      updates: {
        title: "부산 핵심 명소 일일 투어",
        description: "부산의 대표 관광지를 가이드와 함께 둘러보세요. 감천문화마을, 유엔기념공원, 해동용궁사, 청사포, 자갈치시장을 방문합니다. 부산의 필수 명소를 한 번에 만나보세요."
      }
    }
  ];
  
  try {
    console.log('🚀 투어 목록 가져오는 중...');
    
    // 1. 투어 목록 가져오기
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
    
    console.log(`✅ 총 ${listResult.data.length}개 투어 찾음\n`);
    
    // 2. 각 투어 업데이트
    const results = [];
    
    for (const tourUpdate of tourUpdates) {
      const tour = listResult.data.find((t) => t.slug === tourUpdate.slug);
      
      if (!tour) {
        console.log(`⚠️  투어를 찾을 수 없음: ${tourUpdate.slug}`);
        continue;
      }
      
      console.log(`🔄 업데이트 중: ${tour.title}`);
      console.log(`   새 제목: ${tourUpdate.updates.title}`);
      
      const updateResponse = await fetch(`/api/tours/${tour.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include',
        body: JSON.stringify(tourUpdate.updates)
      });
      
      const updateResult = await updateResponse.json();
      
      if (updateResponse.ok && updateResult.success) {
        console.log(`   ✅ 성공!\n`);
        results.push({ slug: tourUpdate.slug, success: true, data: updateResult.data });
      } else {
        console.log(`   ❌ 실패: ${updateResult.error || 'Unknown error'}\n`);
        results.push({ slug: tourUpdate.slug, success: false, error: updateResult.error });
      }
    }
    
    // 3. 결과 요약
    console.log('===========================================');
    console.log('📊 업데이트 결과 요약');
    console.log('===========================================');
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log('');
    
    if (successCount > 0) {
      console.log('✅ 성공한 투어:');
      results.filter(r => r.success).forEach(r => {
        console.log(`   - ${r.data.title}`);
      });
    }
    
    if (failCount > 0) {
      console.log('❌ 실패한 투어:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.slug}: ${r.error}`);
      });
    }
    
    alert(`✅ ${successCount}개 투어 업데이트 완료!`);
    return results;
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    throw error;
  }
})();


