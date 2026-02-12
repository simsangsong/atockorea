// ============================================
// 기존 투어에 다국어 번역 추가 스크립트
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요 (admin 로그인 필요)
//
// 사용 방법:
// 1. /admin에서 로그인
// 2. 브라우저 콘솔(F12) 열기
// 3. 이 스크립트를 복사해서 붙여넣고 실행
// 4. 투어 ID 또는 slug를 입력하거나 아래 예시를 수정하여 사용

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
  
  console.log('🚀 투어 번역 업데이트 시작...');
  console.log('');
  
  // ============================================
  // 여기에 업데이트할 투어 정보 입력
  // ============================================
  
  // 방법 1: 투어 ID로 업데이트 (UUID)
  const tourId = 'YOUR_TOUR_ID_HERE'; // 실제 투어 ID로 변경
  
  // 방법 2: 투어 slug로 업데이트
  // const tourSlug = 'busan-top-attractions-authentic-one-day-guided-tour-1234567890';
  
  // ============================================
  // 번역 데이터 (예시: 부산 투어)
  // ============================================
  const translations = {
    zh: {
      title: "釜山：热门景点正宗一日游",
      tag: "釜山 · 一日游",
      subtitle: "正宗体验",
      description: `探索釜山的热门景点，体验正宗的韩国文化。这个一日游将带您参观甘川文化村、海云台海滩等著名景点。

在专业导游的带领下，深入了解釜山的历史、文化和美食。享受舒适的交通和贴心的服务，让您的釜山之旅成为难忘的回忆。`,
      
      highlights: [
        "参观甘川文化村，探索色彩缤纷的艺术区",
        "在海云台海滩放松，享受韩国最著名的海滩",
        "体验正宗的韩国文化和传统",
        "专业导游陪同，深入了解釜山历史",
        "舒适的交通和贴心的服务"
      ],
      
      includes: [
        "专业英语导游",
        "酒店接送服务",
        "所有景点门票",
        "午餐（传统韩国料理）",
        "空调车辆交通"
      ],
      
      excludes: [
        "个人消费",
        "可选活动",
        "导游和司机小费"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "酒店接送",
          description: "从您的釜山酒店接您"
        },
        {
          time: "09:30",
          title: "甘川文化村",
          description: "探索色彩缤纷的村庄，参观艺术画廊和咖啡馆"
        },
        {
          time: "12:00",
          title: "午餐休息",
          description: "享受当地韩国料理"
        },
        {
          time: "13:30",
          title: "海云台海滩",
          description: "在海滩放松，享受水上活动"
        },
        {
          time: "16:00",
          title: "冬柏岛",
          description: "沿着海岸小径欣赏风景"
        },
        {
          time: "17:30",
          title: "返回酒店",
          description: "送您回酒店"
        }
      ],
      
      faqs: [
        {
          question: "包含什么？",
          answer: "包含专业英语导游、酒店接送、所有景点门票、午餐和交通。"
        },
        {
          question: "需要多长时间？",
          answer: "整个行程大约8小时，从酒店接送到返回。"
        },
        {
          question: "取消政策是什么？",
          answer: "提前24小时取消可全额退款。"
        }
      ],
      
      pickup_info: "可从釜山的酒店、车站和其他地点接送。请在预定时间前10分钟到达集合点。",
      
      notes: `重要信息：

行程详情将在出发前3-5天通过WhatsApp确认。

请穿着舒适的步行鞋。

建议携带防晒霜和帽子。

免费取消：提前24小时取消可全额退款。`
    },
    
    "zh-TW": {
      title: "釜山：熱門景點正宗一日遊",
      tag: "釜山 · 一日遊",
      subtitle: "正宗體驗",
      description: `探索釜山的熱門景點，體驗正宗的韓國文化。這個一日遊將帶您參觀甘川文化村、海雲台海灘等著名景點。

在專業導遊的帶領下，深入了解釜山的歷史、文化和美食。享受舒適的交通和貼心的服務，讓您的釜山之旅成為難忘的回憶。`,
      
      highlights: [
        "參觀甘川文化村，探索色彩繽紛的藝術區",
        "在海雲台海灘放鬆，享受韓國最著名的海灘",
        "體驗正宗的韓國文化和傳統",
        "專業導遊陪同，深入了解釜山歷史",
        "舒適的交通和貼心的服務"
      ],
      
      includes: [
        "專業英語導遊",
        "酒店接送服務",
        "所有景點門票",
        "午餐（傳統韓國料理）",
        "空調車輛交通"
      ],
      
      excludes: [
        "個人消費",
        "可選活動",
        "導遊和司機小費"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "酒店接送",
          description: "從您的釜山酒店接您"
        },
        {
          time: "09:30",
          title: "甘川文化村",
          description: "探索色彩繽紛的村莊，參觀藝術畫廊和咖啡館"
        },
        {
          time: "12:00",
          title: "午餐休息",
          description: "享受當地韓國料理"
        },
        {
          time: "13:30",
          title: "海雲台海灘",
          description: "在海灘放鬆，享受水上活動"
        },
        {
          time: "16:00",
          title: "冬柏島",
          description: "沿著海岸小徑欣賞風景"
        },
        {
          time: "17:30",
          title: "返回酒店",
          description: "送您回酒店"
        }
      ],
      
      faqs: [
        {
          question: "包含什麼？",
          answer: "包含專業英語導遊、酒店接送、所有景點門票、午餐和交通。"
        },
        {
          question: "需要多長時間？",
          answer: "整個行程大約8小時，從酒店接送到返回。"
        },
        {
          question: "取消政策是什麼？",
          answer: "提前24小時取消可全額退款。"
        }
      ],
      
      pickup_info: "可從釜山的酒店、車站和其他地點接送。請在預定時間前10分鐘到達集合點。",
      
      notes: `重要資訊：

行程詳情將在出發前3-5天通過WhatsApp確認。

請穿著舒適的步行鞋。

建議攜帶防曬霜和帽子。

免費取消：提前24小時取消可全額退款。`
    },
    
    ko: {
      title: "부산: 인기 명소 정통 일일 투어",
      tag: "부산 · 일일 투어",
      subtitle: "정통 경험",
      description: `부산의 인기 명소를 탐험하고 정통 한국 문화를 경험하세요. 이 일일 투어는 감천문화마을, 해운대 해변 등 유명 명소를 방문합니다.

전문 가이드와 함께 부산의 역사, 문화, 음식을 깊이 이해하세요. 편안한 교통편과 세심한 서비스로 부산 여행을 잊을 수 없는 추억으로 만드세요.`,
      
      highlights: [
        "감천문화마을 방문, 화려한 예술 지구 탐험",
        "해운대 해변에서 휴식, 한국에서 가장 유명한 해변 즐기기",
        "정통 한국 문화와 전통 경험",
        "전문 가이드 동행, 부산 역사 깊이 이해",
        "편안한 교통편과 세심한 서비스"
      ],
      
      includes: [
        "전문 영어 가이드",
        "호텔 픽업 서비스",
        "모든 명소 입장료",
        "점심 식사 (전통 한국 요리)",
        "에어컨 차량 교통"
      ],
      
      excludes: [
        "개인 비용",
        "선택 활동",
        "가이드 및 운전사 팁"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "호텔 픽업",
          description: "부산의 호텔에서 픽업"
        },
        {
          time: "09:30",
          title: "감천문화마을",
          description: "화려한 마을 탐험, 예술 갤러리 및 카페 방문"
        },
        {
          time: "12:00",
          title: "점심 휴식",
          description: "현지 한국 요리 즐기기"
        },
        {
          time: "13:30",
          title: "해운대 해변",
          description: "해변에서 휴식, 수상 활동 즐기기"
        },
        {
          time: "16:00",
          title: "동백섬",
          description: "해안 산책로를 따라 경치 감상"
        },
        {
          time: "17:30",
          title: "호텔 복귀",
          description: "호텔로 복귀"
        }
      ],
      
      faqs: [
        {
          question: "무엇이 포함되어 있나요?",
          answer: "전문 영어 가이드, 호텔 픽업, 모든 명소 입장료, 점심 식사 및 교통이 포함됩니다."
        },
        {
          question: "소요 시간은 얼마나 되나요?",
          answer: "전체 여행은 약 8시간이며, 호텔 픽업부터 복귀까지입니다."
        },
        {
          question: "취소 정책은 무엇인가요?",
          answer: "24시간 전에 취소하면 전액 환불됩니다."
        }
      ],
      
      pickup_info: "부산의 호텔, 역 및 기타 장소에서 픽업 가능합니다. 예정된 시간 10분 전에 만남 장소에 도착하시기 바랍니다.",
      
      notes: `중요 정보：

일정 세부사항은 출발 3-5일 전 WhatsApp으로 확인됩니다.

편안한 걷기 신발을 착용하세요.

선크림과 모자를 가져오는 것이 좋습니다.

무료 취소：24시간 전에 취소하면 전액 환불됩니다.`
    }
  };
  
  // ============================================
  // API 호출
  // ============================================
  
  try {
    // 먼저 투어 정보 가져오기 (slug로 찾기)
    let tourToUpdate = null;
    
    if (tourId && tourId !== 'YOUR_TOUR_ID_HERE') {
      // ID로 직접 업데이트
      tourToUpdate = tourId;
    } else {
      // slug로 찾기
      console.log('🔍 투어 검색 중...');
      const searchResponse = await fetch('/api/tours', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const searchData = await searchResponse.json();
      const tours = searchData.tours || [];
      
      // slug로 투어 찾기 (또는 다른 방법으로 찾기)
      // 예: tourSlug 변수를 사용하거나, 콘솔에서 직접 입력
      console.log('📋 사용 가능한 투어 목록:');
      tours.forEach((tour, index) => {
        console.log(`${index + 1}. ${tour.title} (ID: ${tour.id}, Slug: ${tour.slug})`);
      });
      
      // 여기서 원하는 투어를 선택하거나, 직접 tourId를 입력하세요
      console.log('');
      console.log('⚠️  위 목록에서 원하는 투어의 ID를 복사하여 tourId 변수에 입력하세요.');
      console.log('예: const tourId = "123e4567-e89b-12d3-a456-426614174000";');
      return;
    }
    
    console.log(`📝 투어 번역 업데이트 중... (ID: ${tourToUpdate})`);
    
    // PATCH 요청으로 translations 필드만 업데이트
    const response = await fetch(`/api/admin/tours/${tourToUpdate}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        translations: translations
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '업데이트 실패');
    }
    
    const result = await response.json();
    console.log('');
    console.log('✅ 투어 번역 업데이트 완료!');
    console.log('📊 결과:', result);
    console.log('');
    console.log('🌐 이제 해당 투어가 다국어로 표시됩니다:');
    console.log(`   - 중국어 간체 (zh): ${translations.zh.title}`);
    console.log(`   - 중국어 번체 (zh-TW): ${translations["zh-TW"].title}`);
    console.log(`   - 한국어 (ko): ${translations.ko.title}`);
    
  } catch (error) {
    console.error('');
    console.error('❌ 오류 발생:', error.message);
    console.error('');
    console.error('💡 해결 방법:');
    console.error('   1. /admin에서 로그인했는지 확인');
    console.error('   2. 투어 ID가 올바른지 확인');
    console.error('   3. API 엔드포인트가 올바른지 확인');
  }
})();




