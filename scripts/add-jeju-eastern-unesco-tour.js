// ============================================
// Add Jeju: Eastern Jeju UNESCO Spots Day Bus Tour
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
    title: "Jeju: Eastern Jeju UNESCO Spots Day Bus Tour",
    slug: "jeju-eastern-unesco-spots-bus-tour",
    city: "Jeju",
    price: 80000,
    price_type: "person",
    image_url: "/images/tours/jeju-eastern-unesco-cover.png", // 세 번째 사진 (커버 이미지)
    
    // ===== 선택 필드 =====
    tag: "UNESCO",
    subtitle: "Top rated",
    description: "Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island. Learn about the island's legendary Haenyeo and discover Micheongul Cave. Discover the enchanting beauty of Jeju Island with our all-inclusive Eastern Euphoria One Day Tour. Jeju, the largest island in Korea, is filled with breathtaking landscapes, UNESCO World Heritage Sites, and unique cultural treasures—and we bring them all to you in one seamless journey.",
    original_price: 80000,
    duration: "10 hours",
    lunch_included: false,
    ticket_included: true,
    
    // 네 개의 이미지를 모두 갤러리에 추가 (세 번째 사진이 커버이므로 첫 번째로 배치)
    gallery_images: [
      "/images/tours/jeju-eastern-unesco-cover.png",        // 세 번째 사진 (커버 이미지) - 성산 일출봉
      "/images/tours/jeju-eastern-unesco-haenyeo.png",      // 첫 번째 사진 - 해녀
      "/images/tours/jeju-eastern-unesco-beach.png",        // 두 번째 사진 - 해변
      "/images/tours/jeju-eastern-unesco-seongsan.png"      // 네 번째 사진 - 성산 일출봉 초록 풀밭
    ],
    
    pickup_info: "**Pick up information:** 1.Ocean Suites Jeju 08:30, 2.Jeju Airport 3rd Floor, Gate 3 (Domestic Departures) at 8:45, 3.Lotte city Hotel jeju 08:55, 4.Shilla Duty-Free Jeju Store at 09:05. You can start your journey immediately with your luggage at the airport. We have selected 4 pick-up locations that are most easily accessible to those traveling to Jeju Island. Please aim to arrive 10 minutes early as it may be crowded. If you do not show up for more than 10 minutes, it will be considered a no-show and you may not receive a refund. You can arrive at the airport early in the morning, start traveling right away with your luggage. Please let us know the amount of luggage in advance.",
    
    notes: "The order of the itinerary may be adjusted or substituted depending on local conditions such as traffic, site availability, or weather. Please provide us with your WhatsApp number. A group chat will be created one day before the tour to share all tour-related information. Our tour ends at Same Pickup Location and Jeju Dongmun Market. These are places most loved by visitors, and they are not related to any forced shopping activities. Our tour does not include any shopping stops—we focus entirely on providing you with the best sightseeing experience. We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide.",
    
    highlights: [
      "Experience Jeju's UNESCO World Heritage Sites in one unforgettable day",
      "Enjoy a hassle-free trip with all admission fees included in one booking",
      "Explore the wonders of a lava tube cave system, a rare geological treasure",
      "Join easily from 4 convenient pickup locations across Jeju City",
      "Learn more with insights from our professional English-speaking guide"
    ],
    
    includes: [
      "Admission to all UNESCO sites (all admission fees)",
      "English-speaking professional guide",
      "A vehicle (Van or Bus) & Driver",
      "Toll fees",
      "Parking fees",
      "Fuel fees",
      "No Shopping stops"
    ],
    
    excludes: [
      "Lunch (food) Fees",
      "Personal expenses",
      "Tips or additional fees",
      "Personal travel insurance"
    ],
    
    schedule: [
      {
        time: "08:30",
        title: "Pickup - Ocean Suites Jeju",
        description: "Pickup from Ocean Suites Jeju Hotel. Please arrive 10 minutes early."
      },
      {
        time: "08:45",
        title: "Pickup - Jeju International Airport",
        description: "Pickup from Jeju Airport 3rd Floor, Gate 3 (Domestic Departures). You can start your journey immediately with your luggage at the airport."
      },
      {
        time: "08:55",
        title: "Pickup - Lotte City Hotel Jeju",
        description: "Pickup from Lotte City Hotel Jeju."
      },
      {
        time: "09:05",
        title: "Pickup - Shilla Duty-Free Jeju Store",
        description: "Pickup from Shilla Duty-Free Jeju Store."
      },
      {
        time: "09:45",
        title: "Hamdeok Seoubong Beach",
        description: "Start your day at one of Jeju's top three beaches, famous for its dazzling ocean colors. In spring, Seoubong hill is blanketed with rapeseed flowers, offering a panoramic seaside view. Break time, Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way."
      },
      {
        time: "10:45",
        title: "Haenyeo Museum",
        description: "Learn about Jeju's legendary 'Haenyeo'—female divers who collect seafood from the ocean floor. Their resilience and unique culture are recognized by UNESCO as an Intangible Cultural Heritage. Photo stop, Visit, Guided tour, Sightseeing, Walk, Scenic views on the way, Arts & crafts market visit."
      },
      {
        time: "12:30",
        title: "Lunch at Local Restaurant",
        description: "Lunch is provided at a local restaurant. (Lunch cost not included; BBQ, local cuisine, and other options are available.) We accommodate all dietary needs, including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals."
      },
      {
        time: "13:30",
        title: "Seongsan Ilchulbong (Haenyeo Show spot)",
        description: "A UNESCO World Natural Heritage site, this iconic volcanic tuff cone offers spectacular views and is one of Jeju's most beloved landmarks. Photo stop, Visit, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way."
      },
      {
        time: "14:30",
        title: "Micheongul Cave at Sunrise Land (Ilchul Land)",
        description: "A fascinating lava tube system, visited instead of Manjanggul (currently closed). Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views on the way."
      },
      {
        time: "15:30",
        title: "Seongeup Folk Village",
        description: "Step back in time as you explore this well-preserved traditional village, where you'll discover the history and culture of Jeju Island. Photo stop, Visit, Guided tour, Free time, Sightseeing, Class, Scenic views on the way."
      },
      {
        time: "18:00",
        title: "Drop-off",
        description: "4 drop-off locations: Jeju Dongmun Traditional Market, Ocean Suites Jeju Hotel, Jeju Airport (CJU), Shilla Duty-Free Jeju Store. This location is a drop-off point and is not related to shopping in any way. We never force any shopping."
      }
    ],
    
    faqs: [
      {
        question: "Is lunch included?",
        answer: "Lunch is provided at a local restaurant, but the cost is not included. BBQ, local cuisine, and other options are available. We accommodate all dietary needs including special dietary requirements, allergies, religious preferences, vegan, halal, and vegetarian meals. If you have any special requirements, please inform your guide."
      },
      {
        question: "What should I bring?",
        answer: "Comfortable shoes, warm clothing, comfortable clothes, cash, and weather-appropriate clothing."
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
        question: "What makes this tour special?",
        answer: "All Admission Fees Included - Transparent pricing, no hidden costs. No Shopping, No Pressure - We never waste your time with souvenir stops or forced shopping. Every moment is dedicated to sightseeing. Professional English-Speaking Guides - Knowledgeable, friendly, and committed to your safe travel. Comfort & Quality - Travel in a clean, air-conditioned vehicle with guaranteed top-rated service."
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
        name: "Jeju International Airport",
        address: "Jeju International Airport, 3rd Floor, Gate 3 (Domestic Departures), 2 Gonghang-ro, Jeju-si, Jeju-do",
        lat: 33.5113,
        lng: 126.4930,
        pickup_time: "08:45:00"
      },
      {
        name: "Lotte city hotel jeju",
        address: "Lotte City Hotel Jeju, 83 Doryeong-ro, Jeju-si, Jeju-do",
        lat: 33.4878,
        lng: 126.4886,
        pickup_time: "08:55:00"
      },
      {
        name: "Shilla duty free shop jeju",
        address: "Shilla Duty-Free Jeju Store, Jeju-si, Jeju-do",
        lat: 33.4996,
        lng: 126.5312,
        pickup_time: "09:05:00"
      }
    ],
    
    rating: 4.9,
    review_count: 1006,
    pickup_points_count: 4,
    dropoff_points_count: 4,
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
