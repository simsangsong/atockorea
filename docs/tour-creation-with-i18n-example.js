// ============================================
// 투어 생성 스크립트 - 다국어 필드 포함 예시
// ============================================
// 이 예시는 투어 생성 시 translations 필드를 포함하는 방법을 보여줍니다.

const tourData = {
  // ===== 필수 필드 =====
  title: "Seoul: Full-Day Private Car Charter Service",
  slug: `seoul-full-day-private-car-charter-${Date.now()}`,
  city: "Seoul",
  price: 235000,
  price_type: "group",
  image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
  
  // ===== 기본 필드 (영어) =====
  tag: "Seoul · Private Tour",
  subtitle: "Top rated",
  description: `Explore Seoul or Gangwon-do at your own pace with a full or half-day private trip with your own personal driver. Customize your day based on your interests.

Embark on a personalized journey through Seoul or the enchanting landscapes of Gangwon-do with our exclusive full or half-day private charter service. Dive into the heart of the city or escape to the serene countryside at your own pace, reveling in the flexibility to craft an itinerary tailored to your interests.

Please be aware that our private charter service provides only transportation; it does not include a guide. This ensures you have the freedom to explore independently while enjoying the convenience of a dedicated driver. If you desire a more guided experience, you have the option to enhance your trip by adding a tour guide who can provide insights and enrich your exploration.`,
  
  original_price: null,
  duration: "10 hours",
  lunch_included: false,
  ticket_included: false,
  
  gallery_images: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
  ],
  
  highlights: [
    "See Alpaca World, Seoraksan National Park, Sokcho City, Chuncheon, and more",
    "Indulge in the freedom offered by our full or half-day private charter service",
    "Discover the highlights of Gangwon-do, Seoul city, or the surrounding suburbs",
    "Savor Korea's essence with delightful local flavors during the private service",
    "Create a personalized tour tailored to your interests and must-see attractions"
  ],
  
  includes: [
    "Private vehicle with driver",
    "Hotel pickup and drop-off within Seoul",
    "Flexible itinerary",
    "10 hours of service"
  ],
  
  excludes: [
    "Tour guide (driver only)",
    "Meals and drinks",
    "Entrance fees",
    "Overtime charges (if applicable)"
  ],
  
  schedule: [
    {
      time: "09:00",
      title: "Hotel Pickup",
      description: "Pickup from your hotel in Seoul"
    },
    {
      time: "09:30",
      title: "Custom Itinerary",
      description: "Visit attractions based on your preferences"
    },
    {
      time: "19:00",
      title: "Hotel Drop-off",
      description: "Return to your hotel"
    }
  ],
  
  faqs: [
    {
      question: "What is included in the service?",
      answer: "The service includes a private vehicle with driver, hotel pickup and drop-off within Seoul, and 10 hours of service. The driver does not serve as a guide."
    },
    {
      question: "Can I customize the itinerary?",
      answer: "Yes, you can customize your itinerary based on your interests. Please discuss your preferences with the driver at the start of the tour."
    },
    {
      question: "What are the overtime charges?",
      answer: "Overtime charges apply if the service exceeds 10 hours. Groups of 1-10: KRW 25,000 per hour. Groups of 11-14: KRW 50,000 per hour."
    }
  ],
  
  pickup_info: `Pickup services are available only within Seoul City. If you are staying outside of this area, please choose a meeting point within the pickup zone (e.g., a specific station exit in Seoul). Please ensure that you arrive at the meeting point 10 minutes before the scheduled time.

Pickup and drop-off are available at hotels, stations, and other locations within Seoul City.`,
  
  notes: `Important Information - Know before you go:

Itinerary details will be confirmed 3-5 days before departure via WhatsApp.

Pick-up vehicles (Solati or Starex/Staria) are assigned based on participant numbers.

The driver does not enter attractions.

Total service duration is 5 or 10 hours, from meet-up to drop-off.

Overtime charges:
• Groups of 1-10: KRW 25,000 per hour
• Groups of 11-14: KRW 50,000 per hour
Overtime charges (including extended durations at spots, traffic jams) are payable in cash.

The driver will try to find free parking; paid parking charges will be claimed based on receipt and settled in cash at the end of the tour.

Free cancellation: Cancel up to 24 hours in advance for a full refund.

Reserve now & pay later: Keep your travel plans flexible — book your spot and pay nothing today.`,
  
  // ============================================
  // 다국어 번역 필드 (translations)
  // ============================================
  translations: {
    // 중국어 간체
    zh: {
      title: "首尔：全天私人包车服务",
      tag: "首尔 · 私人游",
      subtitle: "高评分",
      description: `按照自己的节奏探索首尔或江原道，享受全天或半天的私人包车服务，配备专属司机。根据您的兴趣定制行程。

踏上个性化的首尔之旅，或探索迷人的江原道风景，享受我们专属的全天或半天私人包车服务。深入城市中心，或逃离到宁静的乡村，享受自由，打造适合您兴趣的行程。

请注意，我们的私人包车服务仅提供交通服务；不包括导游。这确保您可以自由独立探索，同时享受专属司机的便利。如果您希望获得更多指导，可以选择添加导游，为您提供见解并丰富您的探索体验。`,
      
      highlights: [
        "参观羊驼世界、雪岳山国家公园、束草市、春川等",
        "享受我们全天或半天私人包车服务提供的自由",
        "发现江原道、首尔市或周边郊区的亮点",
        "在私人服务期间品尝韩国当地风味",
        "根据您的兴趣和必看景点创建个性化行程"
      ],
      
      includes: [
        "带司机的私人车辆",
        "首尔市内酒店接送",
        "灵活行程",
        "10小时服务"
      ],
      
      excludes: [
        "导游（仅司机）",
        "餐饮",
        "门票",
        "超时费用（如适用）"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "酒店接送",
          description: "从您首尔的酒店接您"
        },
        {
          time: "09:30",
          title: "定制行程",
          description: "根据您的喜好参观景点"
        },
        {
          time: "19:00",
          title: "酒店送返",
          description: "返回您的酒店"
        }
      ],
      
      faqs: [
        {
          question: "服务包含什么？",
          answer: "服务包括带司机的私人车辆、首尔市内酒店接送和10小时服务。司机不担任导游。"
        },
        {
          question: "我可以定制行程吗？",
          answer: "可以，您可以根据自己的兴趣定制行程。请在行程开始时与司机讨论您的偏好。"
        },
        {
          question: "超时费用是多少？",
          answer: "如果服务超过10小时，将收取超时费用。1-10人团体：每小时25,000韩元。11-14人团体：每小时50,000韩元。"
        }
      ],
      
      pickup_info: `接送服务仅在首尔市内提供。如果您住在该区域外，请选择接送区域内的集合点（例如，首尔的特定地铁站出口）。请确保在预定时间前10分钟到达集合点。

接送服务可在首尔市内的酒店、车站和其他地点提供。`,
      
      notes: `重要信息 - 出发前须知：

行程详情将在出发前3-5天通过WhatsApp确认。

接送车辆（Solati或Starex/Staria）根据参与者人数分配。

司机不进入景点。

总服务时长为5或10小时，从集合到送返。

超时费用：
• 1-10人团体：每小时25,000韩元
• 11-14人团体：每小时50,000韩元
超时费用（包括在景点停留时间延长、交通堵塞）需以现金支付。

司机将尽量寻找免费停车位；付费停车费将根据收据收取，并在行程结束时以现金结算。

免费取消：提前24小时取消可全额退款。

立即预订，稍后付款：保持您的旅行计划灵活 — 预订您的名额，今天无需付款。`
    },
    
    // 중국어 번체
    "zh-TW": {
      title: "首爾：全天私人包車服務",
      tag: "首爾 · 私人遊",
      subtitle: "高評分",
      description: `按照自己的節奏探索首爾或江原道，享受全天或半天的私人包車服務，配備專屬司機。根據您的興趣定制行程。

踏上個性化的首爾之旅，或探索迷人的江原道風景，享受我們專屬的全天或半天私人包車服務。深入城市中心，或逃離到寧靜的鄉村，享受自由，打造適合您興趣的行程。

請注意，我們的私人包車服務僅提供交通服務；不包括導遊。這確保您可以自由獨立探索，同時享受專屬司機的便利。如果您希望獲得更多指導，可以選擇添加導遊，為您提供見解並豐富您的探索體驗。`,
      
      highlights: [
        "參觀羊駝世界、雪嶽山國家公園、束草市、春川等",
        "享受我們全天或半天私人包車服務提供的自由",
        "發現江原道、首爾市或周邊郊區的亮點",
        "在私人服務期間品嚐韓國當地風味",
        "根據您的興趣和必看景點創建個性化行程"
      ],
      
      includes: [
        "帶司機的私人車輛",
        "首爾市內酒店接送",
        "靈活行程",
        "10小時服務"
      ],
      
      excludes: [
        "導遊（僅司機）",
        "餐飲",
        "門票",
        "超時費用（如適用）"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "酒店接送",
          description: "從您首爾的酒店接您"
        },
        {
          time: "09:30",
          title: "定制行程",
          description: "根據您的喜好參觀景點"
        },
        {
          time: "19:00",
          title: "酒店送返",
          description: "返回您的酒店"
        }
      ],
      
      faqs: [
        {
          question: "服務包含什麼？",
          answer: "服務包括帶司機的私人車輛、首爾市內酒店接送和10小時服務。司機不擔任導遊。"
        },
        {
          question: "我可以定制行程嗎？",
          answer: "可以，您可以根據自己的興趣定制行程。請在行程開始時與司機討論您的偏好。"
        },
        {
          question: "超時費用是多少？",
          answer: "如果服務超過10小時，將收取超時費用。1-10人團體：每小時25,000韓元。11-14人團體：每小時50,000韓元。"
        }
      ],
      
      pickup_info: `接送服務僅在首爾市內提供。如果您住在該區域外，請選擇接送區域內的集合點（例如，首爾的特定地鐵站出口）。請確保在預定時間前10分鐘到達集合點。

接送服務可在首爾市內的酒店、車站和其他地點提供。`,
      
      notes: `重要資訊 - 出發前須知：

行程詳情將在出發前3-5天通過WhatsApp確認。

接送車輛（Solati或Starex/Staria）根據參與者人數分配。

司機不進入景點。

總服務時長為5或10小時，從集合到送返。

超時費用：
• 1-10人團體：每小時25,000韓元
• 11-14人團體：每小時50,000韓元
超時費用（包括在景點停留時間延長、交通堵塞）需以現金支付。

司機將盡量尋找免費停車位；付費停車費將根據收據收取，並在行程結束時以現金結算。

免費取消：提前24小時取消可全額退款。

立即預訂，稍後付款：保持您的旅行計劃靈活 — 預訂您的名額，今天無需付款。`
    },
    
    // 한국어
    ko: {
      title: "서울: 종일 프라이빗 차량 대여 서비스",
      tag: "서울 · 프라이빗 투어",
      subtitle: "최고 평점",
      description: `전용 운전사와 함께 서울 또는 강원도를 자유롭게 탐험하는 종일 또는 반일 프라이빗 투어입니다. 관심사에 맞춰 하루를 맞춤 설정하세요.

서울을 개인화된 여행으로 탐험하거나 강원도의 매혹적인 풍경을 즐기며, 독점적인 종일 또는 반일 프라이빗 차량 대여 서비스를 이용하세요. 도시의 중심으로 뛰어들거나 평화로운 시골로 탈출하여 자유롭게 여행하며 관심사에 맞는 일정을 만들 수 있습니다.

프라이빗 차량 대여 서비스는 교통편만 제공하며 가이드는 포함되지 않습니다. 이는 전용 운전사의 편의를 즐기면서 독립적으로 자유롭게 탐험할 수 있도록 합니다. 더 많은 가이드가 필요하시다면, 통찰력을 제공하고 탐험을 풍부하게 만들어줄 투어 가이드를 추가할 수 있습니다.`,
      
      highlights: [
        "알파카 월드, 설악산 국립공원, 속초시, 춘천 등 방문",
        "종일 또는 반일 프라이빗 차량 대여 서비스가 제공하는 자유로움을 즐기세요",
        "강원도, 서울시 또는 주변 교외의 하이라이트 발견",
        "프라이빗 서비스 중 한국의 본질을 맛있는 현지 맛으로 즐기세요",
        "관심사와 필수 방문 명소에 맞춘 개인화된 투어 만들기"
      ],
      
      includes: [
        "운전사가 있는 프라이빗 차량",
        "서울 시내 호텔 픽업 및 하차",
        "유연한 일정",
        "10시간 서비스"
      ],
      
      excludes: [
        "투어 가이드 (운전사만)",
        "식사 및 음료",
        "입장료",
        "초과 시간 요금 (해당되는 경우)"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "호텔 픽업",
          description: "서울의 호텔에서 픽업"
        },
        {
          time: "09:30",
          title: "맞춤 일정",
          description: "선호도에 따라 명소 방문"
        },
        {
          time: "19:00",
          title: "호텔 하차",
          description: "호텔로 복귀"
        }
      ],
      
      faqs: [
        {
          question: "서비스에 무엇이 포함되어 있나요?",
          answer: "서비스에는 운전사가 있는 프라이빗 차량, 서울 시내 호텔 픽업 및 하차, 10시간 서비스가 포함됩니다. 운전사는 가이드를 제공하지 않습니다."
        },
        {
          question: "일정을 맞춤 설정할 수 있나요?",
          answer: "네, 관심사에 따라 일정을 맞춤 설정할 수 있습니다. 투어 시작 시 운전사와 선호도를 논의해 주세요."
        },
        {
          question: "초과 시간 요금은 얼마인가요?",
          answer: "서비스가 10시간을 초과하면 초과 시간 요금이 적용됩니다. 1-10명 그룹: 시간당 25,000원. 11-14명 그룹: 시간당 50,000원."
        }
      ],
      
      pickup_info: `픽업 서비스는 서울 시내에서만 제공됩니다. 이 지역 외에 머무르시는 경우, 픽업 구역 내의 만남 장소를 선택해 주세요 (예: 서울의 특정 지하철역 출구). 예정된 시간 10분 전에 만남 장소에 도착하시기 바랍니다.

픽업 및 하차는 서울 시내의 호텔, 역 및 기타 장소에서 이용 가능합니다.`,
      
      notes: `중요 정보 - 출발 전 알아두세요:

일정 세부사항은 출발 3-5일 전 WhatsApp으로 확인됩니다.

픽업 차량(Solati 또는 Starex/Staria)은 참가자 수에 따라 배정됩니다.

운전사는 명소에 들어가지 않습니다.

총 서비스 시간은 만남부터 하차까지 5시간 또는 10시간입니다.

초과 시간 요금:
• 1-10명 그룹: 시간당 25,000원
• 11-14명 그룹: 시간당 50,000원
초과 시간 요금(명소에서의 연장 시간, 교통 체증 포함)은 현금으로 지불해야 합니다.

운전사는 무료 주차를 찾으려고 노력하며; 유료 주차 요금은 영수증을 기준으로 청구되며 투어 종료 시 현금으로 정산됩니다.

무료 취소: 24시간 전에 취소하면 전액 환불됩니다.

지금 예약하고 나중에 결제: 여행 계획을 유연하게 유지하세요 — 지금 자리를 예약하고 오늘은 아무것도 지불하지 않으세요.`
    }
  }
};

// ============================================
// API 호출 예시
// ============================================
// 실제 스크립트에서는 이렇게 API를 호출합니다:

/*
(async () => {
  // 토큰 가져오기
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
  
  // API 호출
  const response = await fetch('/api/admin/tours', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(tourData)
  });
  
  const result = await response.json();
  console.log('✅ 투어 생성 완료:', result);
})();
*/




