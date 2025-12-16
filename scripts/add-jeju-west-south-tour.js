// ============================================
// Add Jeju: West & South Full-Day Authentic Bus Tour
// ============================================
// This script creates a tour via API
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
  
  const tourData = {
    // ===== 필수 필드 =====
    title: "제주 서부&남부 올데이 버스 투어",
    slug: "jeju-west-south-full-day-bus-tour",
    city: "Jeju",
    price: 70000,
    price_type: "person",
    image_url: "/images/tours/jeju-west-south-cover.png", // 다섯 번째 사진 (커버 이미지) - 돌하르방과 전통 건물
    
    // ===== 선택 필드 =====
    tag: "Full Day",
    subtitle: "Top rated",
    description: "제주 서부와 남부를 하루에 둘러보는 투어. 산책로, 녹차밭, 지역 체험, 해안 폭포를 즐기며 제주의 자연과 문화를 경험하세요.",
    original_price: 80000,
    duration: "10 hours",
    lunch_included: false,
    ticket_included: true,
    
    // 다섯 번째 사진을 커버로, 나머지 5개를 갤러리에 추가
    gallery_images: [
      "/images/tours/jeju-west-south-tea-field.png",      // 첫 번째 사진 - 녹차밭 (O'sulloc)
      "/images/tours/jeju-west-south-cliff-view.png",     // 두 번째 사진 - 주상절리 절벽 전망대
      "/images/tours/jeju-west-south-snow-road.png",      // 세 번째 사진 - 눈 덮인 겨울 도로
      "/images/tours/jeju-west-south-cliff-waves.png",    // 네 번째 사진 - 주상절리 절벽 파도
      "/images/tours/jeju-west-south-hiking-trail.png"    // 여섯 번째 사진 - 눈 덮인 하이킹 트레일
    ],
    
    pickup_info: "**Pick up information:** 1.Ocean Suites Jeju 08:30, 2.Jeju Airport 3rd Floor, Gate 3 (Domestic Departures) at 8:45, 3.Lotte city Hotel jeju 08:55, 4.Shilla Duty-Free Jeju Store at 09:05. You can start your journey immediately with your luggage at the airport. We have selected 4 pick-up locations that are most easily accessible to those traveling to Jeju Island. Please aim to arrive 10 minutes early as it may be crowded. If you do not show up for more than 10 minutes, it will be considered a no-show and you may not receive a refund. You can arrive at the airport early in the morning, start traveling right away with your luggage. Please let us know the amount of luggage in advance. Please refer to the full description for the detailed itinerary!",
    
    notes: "This location is a drop-off point and is not related to shopping in any way. We never force any shopping. Tour ending time may vary based on traffic or weather. If dropped off at Dongmun Market, it's a 5-minute walk to Black Pork Street. Whistle Lark and Regent Marine hotels are about a 10-minute walk away. We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide. Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information.",
    
    highlights: [
      "Travel the south & west in just one day with a certified guide",
      "Convenient 4 pickup locations & 5 drop-off locations (No Shopping)",
      "Experience Jeju's stunning nature and culture in one unforgettable day",
      "Enjoy a hassle-free trip with all admission fees included in one booking",
      "Combining it with the eastern tour is the best choice"
    ],
    
    includes: [
      "All entry tickets (admission fees)",
      "UNESCO guided tour licensed",
      "English speaking guide",
      "Toll fee",
      "Parking fee",
      "Fuel fee",
      "A comfortable vehicle with air conditioning",
      "No Shopping stops"
    ],
    
    excludes: [
      "Lunch (Fees)",
      "Personal expenses",
      "Personal travel insurance",
      "Black Pig Feeding Experience (Optional, KRW 2,000 on-site)",
      "Tangerine Picking Experience (Pay on-site)"
    ],
    
    schedule: [
      {
        time: "08:30",
        title: "Pickup - Ocean Suites Jeju",
        description: "First pickup point. Please arrive 10 minutes early."
      },
      {
        time: "08:45",
        title: "Pickup - Jeju Airport 3rd Floor, Gate 3",
        description: "Second pickup point. You can start your journey immediately with your luggage at the airport."
      },
      {
        time: "08:55",
        title: "Pickup - Lotte City Hotel Jeju",
        description: "Third pickup point."
      },
      {
        time: "09:05",
        title: "Pickup - Shilla Duty-Free Jeju Store",
        description: "Fourth pickup point."
      },
      {
        time: "09:30-11:00",
        title: "Mt. Halla - Eoseungsaengak Trail",
        description: "Enjoy an easy trail offering beautiful views of Hallasan and Jeju's volcanic landscape. Weather-dependent: may change to the 1100 Altitude Wetland or Saebyeol Oreum. Guided tour, Sightseeing."
      },
      {
        time: "11:30-12:30",
        title: "O'sulloc Tea Museum & Green Tea Fields",
        description: "Explore Jeju's most famous tea museum, stroll through wide green tea fields, and enjoy green tea desserts. Free time, Sightseeing."
      },
      {
        time: "13:00-14:00",
        title: "Lunch at Local Restaurant",
        description: "Enjoy authentic Korean dishes with various menu options. Please inform your guide of any dietary restrictions. Lunch (1 hour). Optional. BBQ, local cuisine, and other options available. We accommodate all dietary needs."
      },
      {
        time: "14:30-15:30",
        title: "Jusangjeollidae (Jusangjeolli Cliff)",
        description: "Dramatic volcanic rock pillars, shaped into geometric patterns, formed centuries ago when lava flows met the ocean. Guided tour, Sightseeing."
      },
      {
        time: "16:00-17:00",
        title: "Hueree Nature Life Park",
        description: "A peaceful nature park famous for seasonal flowers and countryside charm. Optional: Jeju Black Pig Feeding Experience available on-site (KRW 2,000). Guided tour, Sightseeing."
      },
      {
        time: "17:00-17:30",
        title: "Tangerine Picking Experience",
        description: "Visit a nearby orchard to pick fresh Jeju tangerines by hand. Pay on-site."
      },
      {
        time: "17:30-18:00",
        title: "Jeongbang Waterfall",
        description: "A rare coastal waterfall dropping directly into the sea. If closed due to weather, this stop will be replaced with Cheonjiyeon Waterfall. Free time, Sightseeing."
      },
      {
        time: "18:00+",
        title: "Drop-off at 5 locations",
        description: "Shilla Duty Free Jeju, LOTTE City Hotel Jeju, Jeju Airport (CJU), Ocean Suites Jeju Hotel, Jeju Dongmun Traditional Market (Self-Guided, Only drop). This location is a drop-off point and is not related to shopping in any way. We never force any shopping."
      }
    ],
    
    faqs: [
      {
        question: "Is lunch included?",
        answer: "Lunch is provided at a local restaurant, but the cost is not included. BBQ, local cuisine, and other options are available. We accommodate all dietary needs including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide."
      },
      {
        question: "Are admission fees included?",
        answer: "Yes, all entry tickets (admission fees) are included in the tour price."
      },
      {
        question: "What about optional activities?",
        answer: "Black Pig Feeding Experience at Hueree Nature Life Park is optional and costs KRW 2,000 on-site. Tangerine Picking Experience is also available and payment is made on-site."
      },
      {
        question: "What should I bring?",
        answer: "Comfortable walking shoes, weather-appropriate clothing, and cash for optional activities and lunch."
      },
      {
        question: "Can I cancel my booking?",
        answer: "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        question: "When will I receive tour information?",
        answer: "Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information."
      },
      {
        question: "What if the weather is bad?",
        answer: "Timings and locations may vary depending on traffic and weather conditions. Mt. Halla trail may change to 1100 Altitude Wetland or Saebyeol Oreum. If Jeongbang Waterfall is closed due to weather, it will be replaced with Cheonjiyeon Waterfall."
      }
    ],
    
    pickup_points: [
      {
        name: "Ocean Suites Jeju",
        address: "Ocean Suites Jeju, 263, Yeon-dong, Jeju-si, Jeju-do",
        lat: 33.4996,
        lng: 126.5312,
        pickup_time: "08:30:00"
      },
      {
        name: "Jeju Airport 3rd Floor, Gate 3",
        address: "Jeju International Airport, 2 Gonghang-ro, Jeju-si, Jeju-do",
        lat: 33.5113,
        lng: 126.4930,
        pickup_time: "08:45:00"
      },
      {
        name: "Lotte City Hotel Jeju",
        address: "Lotte City Hotel Jeju, 83 Doryeong-ro, Jeju-si, Jeju-do",
        lat: 33.4878,
        lng: 126.4886,
        pickup_time: "08:55:00"
      },
      {
        name: "Shilla Duty-Free Jeju Store",
        address: "Shilla Duty-Free Jeju Store, Jeju-si, Jeju-do",
        lat: 33.4996,
        lng: 126.5312,
        pickup_time: "09:05:00"
      }
    ],
    
    rating: 4.9,
    review_count: 323,
    pickup_points_count: 4,
    dropoff_points_count: 5,
    is_active: true,
    is_featured: true
  };
  
  try {
    console.log('🚀 투어 추가 시작...');
    console.log(`📦 투어 제목: ${tourData.title}`);
    console.log(`🏷️  Slug: ${tourData.slug}\n`);
    
    // 헤더 준비
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    
    console.log('✅ Authorization 헤더 설정 완료\n');
    console.log('📡 API 호출 중...');
    
    // API 호출
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify(tourData)
    });
    
    console.log(`응답 상태: ${response.status} ${response.statusText}\n`);
    
    const result = await response.json();
    
    if (result.data) {
      console.log('✅ 투어 생성 성공!');
      console.log('📋 생성된 투어 정보:');
      console.log(`   ID: ${result.data.id}`);
      console.log(`   제목: ${result.data.title}`);
      console.log(`   Slug: ${result.data.slug}`);
      console.log(`   가격: ₩${result.data.price.toLocaleString()}`);
      console.log(`   도시: ${result.data.city}`);
      console.log(`   픽업 지점 수: ${tourData.pickup_points.length}`);
      console.log(`   커버 이미지: ${tourData.image_url}`);
      console.log(`   갤러리 이미지 수: ${tourData.gallery_images.length}개`);
      console.log('');
      console.log(`🌐 투어 확인: /tour/${result.data.slug}`);
      alert('✅ 투어 생성 성공!\n\n투어 ID: ' + result.data.id + '\n제목: ' + result.data.title);
      return result.data;
    } else {
      console.error('❌ 투어 생성 실패');
      console.error('에러:', result.error);
      console.error('전체 응답:', result);
      alert('❌ 투어 생성 실패: ' + (result.error || 'Unknown error'));
      throw new Error(result.error || 'Failed to create tour');
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    throw error;
  }
})();
