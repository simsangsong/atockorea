// ============================================
// Add Seoul: Full-Day Private Car Charter Service
// ============================================
// 브라우저 콘솔(F12)에서 실행하세요 (admin 로그인 필요)
//
// 사용 방법:
// 1. /admin에서 로그인
// 2. 브라우저 콘솔(F12) 열기
// 3. 이 스크립트 전체를 복사해서 붙여넣고 실행
// 4. 자동으로 투어가 생성됩니다

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
  
  console.log('🚀 서울 프라이빗 카 투어 추가 시작...');
  console.log('');
  
  // 투어 데이터 생성
  const timestamp = Date.now();
  const newSlug = `seoul-full-day-private-car-charter-${timestamp}`;
  
  // €164를 원화로 변환 (대략 235,000원, 실제 환율에 맞게 조정 필요)
  const priceInWon = 235000; // €164 ≈ 235,000원 (group price up to 6)
  
  const tourData = {
    // ===== 필수 필드 =====
    title: "Seoul: Full-Day Private Car Charter Service",
    slug: newSlug,
    city: "Seoul",
    price: priceInWon,
    price_type: "group",
    image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80", // 임시 이미지, 실제 이미지로 교체 필요
    
    // ===== 선택 필드 =====
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
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop"
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

Free cancellation: Cancel up to 24 hours in advance for a full refund.`,
    
    highlights: [
      "See Alpaca World, Seoraksan National Park, Sokcho City, Chuncheon, and more",
      "Indulge in the freedom offered by our full or half-day private charter service",
      "Discover the highlights of Gangwon-do, Seoul city, or the surrounding suburbs",
      "Savor Korea's essence with delightful local flavors during the private service",
      "Create a personalized tour tailored to your interests and must-see attractions"
    ],
    
    includes: [
      "Full day or half day use of a private car",
      "Professional driver",
      "Pickup and drop-off in Seoul"
    ],
    
    excludes: [
      "Airport pickup and drop-off",
      "Entry fees to attractions, museums, or any other sites visited",
      "Parking fees",
      "Meals and beverages",
      "Tour guide services",
      "Overtime charges",
      "Tips for the driver"
    ],
    
    schedule: [
      {
        time: "09:00",
        title: "Pickup - Seoul City",
        description: "Pickup from your hotel, station, or designated meeting point within Seoul City. Please arrive 10 minutes before the scheduled time."
      },
      {
        time: "09:00-19:00",
        title: "Customized Tour (Choose Your Route)",
        description: `Seoul City: Gyeongbokgung Palace, Myeongdong, Dongdaemun, Cheonggyecheon, N Seoul Tower, Gangnam, Lotte World, Bukchon Hanok Village, Yeouido, Hangang Park, Hongdae, Ewha Woman's University, Sinchon, and other exciting locations.

Seoul Suburbs: Incheon City, Woongjin Playdoci, Everland, Seoul Park, One Mount, Swiss Village, Korean Folk Village, Paju Outlets, Imjingak Nuri Peace Park, The Garden of Morning Calm, Petite France, Nami Island, Chuncheon City, Gangchon Rail Bike, Herb Garden, Heyri Art Village, and other delightful locations surrounding Seoul.

Gangwon-do: Alpaca World, Seoraksan National Park, Sokcho City, Chuncheon City, Daegwallyeong Sheep Ranch, Pyeongchang, Yongpyong, Phoenix Park, Alpensia Resort, High One Resort, Donghae City, and other captivating places in Gangwon-do.

You have the freedom to customize your itinerary based on your interests. The driver will take you to your chosen destinations.`
      },
      {
        time: "13:00",
        title: "Lunch (Optional)",
        description: "Enjoy local Korean cuisine at a restaurant of your choice. Meal costs are separate."
      },
      {
        time: "19:00",
        title: "Drop-off - Seoul City",
        description: "Return to your hotel or preferred drop-off location within Seoul City."
      }
    ],
    
    faqs: [
      {
        question: "What is included in the tour?",
        answer: "Full day or half day use of a private car, professional driver, and pickup and drop-off in Seoul are included."
      },
      {
        question: "What is not included?",
        answer: "Airport pickup and drop-off, entry fees to attractions, parking fees, meals and beverages, tour guide services, overtime charges, and tips for the driver are not included."
      },
      {
        question: "How long is the tour?",
        answer: "The tour duration is 10 hours for full-day service or 5 hours for half-day service, from meet-up to drop-off."
      },
      {
        question: "What is the group size?",
        answer: "This is a private tour for up to 6 people per group. For groups of 11-14, different vehicles and pricing apply."
      },
      {
        question: "Does the driver speak English?",
        answer: "Yes, the driver can speak Chinese, English, and Korean."
      },
      {
        question: "Is a tour guide included?",
        answer: "No, the service provides only transportation with a driver. The driver does not enter attractions. However, you can add a professional tour guide as an additional option."
      },
      {
        question: "What happens if we exceed the tour duration?",
        answer: "Overtime charges apply: KRW 25,000 per hour for groups of 1-10, and KRW 50,000 per hour for groups of 11-14. Overtime charges are payable in cash."
      },
      {
        question: "Are parking fees included?",
        answer: "The driver will try to find free parking. If paid parking is required, charges will be claimed based on receipt and settled in cash at the end of the tour."
      },
      {
        question: "Can I customize the itinerary?",
        answer: "Yes, you have complete freedom to customize your itinerary. You can choose destinations from Seoul City, Seoul Suburbs, or Gangwon-do based on your interests."
      },
      {
        question: "When will I receive the itinerary details?",
        answer: "Itinerary details will be confirmed 3-5 days before departure via WhatsApp."
      },
      {
        question: "Is airport pickup available?",
        answer: "Airport pickup and drop-off are available as an additional option. The duration of this service is included in the total 5/10 hours for the half or full-day private charter."
      },
      {
        question: "What is the cancellation policy?",
        answer: "Free cancellation: Cancel up to 24 hours in advance for a full refund."
      }
    ],
    
    rating: 4.7,
    review_count: 120,
    pickup_points_count: 1,
    dropoff_points_count: 1,
    is_active: true,
    is_featured: true
  };
  
  // 투어 생성
  console.log('📡 투어 생성 중...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  try {
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify(tourData)
    });
    
    const result = await response.json();
    
    console.log('📡 응답 상태:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('❌ 투어 생성 실패');
      console.error('에러:', result.error || result.message);
      console.error('전체 응답:', result);
      throw new Error(result.error || '투어 생성 실패');
    }
    
    console.log('');
    console.log('✅ 투어 생성 성공!');
    console.log('📋 생성된 투어 정보:');
    console.log('   ID:', result.data?.id);
    console.log('   제목:', result.data?.title);
    console.log('   Slug:', result.data?.slug);
    console.log('   가격: ₩' + (result.data?.price || priceInWon).toLocaleString() + ' (그룹당, 최대 6명)');
    console.log('   도시:', result.data?.city);
    console.log('   가격 타입:', result.data?.price_type);
    console.log('');
    console.log('🔗 투어 링크:', `/tour/${result.data?.slug || result.data?.id}`);
    console.log('');
    
    alert('✅ 투어 생성 성공!\n\n투어 ID: ' + result.data?.id + '\n제목: ' + result.data?.title);
    
    return result.data;
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    throw error;
  }
})();




