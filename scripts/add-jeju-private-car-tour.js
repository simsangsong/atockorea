// ============================================
// Add Jeju: Private Car Charter Tour
// ============================================
// This script creates a private tour via API
// Run this in browser console after logging in as admin
// 이미지 정보는 이미지에서 추출한 텍스트만 사용합니다.
// 썸네일과 갤러리 이미지는 나중에 별도로 업로드합니다.

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
  
  // 가격 설정: 이미지에서 추출한 정보
  // "From ₩399,000 per group up to 6" (6명 기준)
  // 제주 시내 픽업: ₩399,000 (6명 기준, 1인당 ₩66,500)
  // 제주 시외 픽업: ₩471,500 (6명 기준, 1인당 ₩78,583)
  const basePrice = 399000; // 6명 기준 기본 가격 (제주 시내 픽업)
  const originalPrice = 471500; // 6명 기준 원가 (제주 시외 픽업 기준으로 설정)
  
  // 새로 생성하기 위해 타임스탬프를 slug에 추가
  const timestamp = Date.now();
  const newSlug = `jeju-private-car-charter-tour-${timestamp}`;
  
  // ============================================
  // 이미지 경로 설정
  // ============================================
  // 대화창에 업로드한 이미지들을 Supabase에 업로드한 후 경로를 여기에 삽입하세요
  // 
  // 이미지 순서:
  // 1. 돌하르방과 바다 (갤러리)
  // 2. 해녀 행진 (갤러리)
  // 3. 눈 덮인 풍경에서 말 타는 사진 (갤러리)
  // 4. 핑크 뮬리 풀 (갤러리)
  // 5. 검은색 미니밴이 해안 도로를 달리는 사진 (썸네일) ⭐
  // 6. 일출/일몰 다리 (갤러리)
  // 7. 성산일출봉 (갤러리)
  //
  // 아래 경로는 임시 경로입니다. 실제 업로드 후 경로로 교체하세요.
  
  // 5번째 사진: 검은색 미니밴이 해안 도로를 달리는 사진 (썸네일/首图)
  const thumbnailImage = ""; // TODO: Supabase 업로드 후 경로 삽입
  
  // 갤러리 이미지: 나머지 6장 사진들 (5번째 제외)
  const galleryImages = [
    "", // 1번: Dol hareubang stone statue on Jeju coast (돌하르방과 바다) - TODO: 경로 삽입
    "", // 2번: Haenyeo parade (해녀 행진) - TODO: 경로 삽입
    "", // 3번: Horses in snow (눈 덮인 풍경에서 말 타는 사진) - TODO: 경로 삽입
    "", // 4번: Pink Muhly grass with Dol hareubang (핑크 뮬리 풀) - TODO: 경로 삽입
    "", // 6번: Sunset/sunrise bridge scene (일출/일몰 다리) - TODO: 경로 삽입
    ""  // 7번: Seongsan Ilchulbong Peak scene (성산일출봉) - TODO: 경로 삽입
  ].filter(url => url !== ""); // 빈 문자열 제거
  
  // 이미지에서 추출한 텍스트 정보로 투어 데이터 생성
  const tourData = {
    // ===== 필수 필드 =====
    title: "Jeju Island: Private Car Charter Tour",
    slug: newSlug,
    city: "Jeju",
    price: basePrice,
    price_type: "group", // 그룹당 가격
    image_url: thumbnailImage, // 5번째 사진: Black minivan on coastal road
    
    // ===== 선택 필드 =====
    tag: "Private Tour · Day tour",
    subtitle: "Customized Experience",
    description: "Hire a car and licensed guide for a day and make seeing the top sights in Jeju a breeze for this largest island in Korea. Travel in an air-conditioned car with plenty of space. Relax and let your driver take you to the sights that interest you most. Skip the hassle of public transportation. Begin your customized tour of Jeju at the time that best fits you and benefit from an itinerary that can be altered and adjusted according to your interests. With a wealth of attractions on offer at all the major sightseeing spots, your guided tour will give you a personalized experience in paradise.",
    original_price: originalPrice,
    duration: "9 hours",
    lunch_included: false,
    ticket_included: false,
    
    // 갤러리: 6장의 이미지 (1, 2, 3, 4, 6, 7번 사진)
    gallery_images: galleryImages,
    
    pickup_info: "Please wait in the hotel lobby 10 minutes before your scheduled pickup time. Pickup within Jeju Downtown Area (within 6km from Jeju Airport, e.g., Nohyeong-dong or Yeon-dong) is included in the base price. Pickup outside of Jeju City (Seogwipo, Aewol, Hanlim, Seongsan, Hangyeong, Jochon, Pyoseon, Namwon, Andeok, Daejeong, etc.) incurs an additional fee. Airport pickup and drop-off services on the tour date are free of charge if requested. Please provide the exact number of passengers and luggage when booking.",
    
    notes: `Important Information - Know before you go:

There will be overtime charge if you use the vehicle over 9 hours, an additional hour fee is 25,000 won per hour, please pay in cash to the driver.

In order to make the most of your time, your private customized itineraries are limited to visit in one area (ex. Eastern tour in one day / Southern tour in one day), otherwise you will waste a lot of time on the road. If you want to visit two different parts of island in a day, extra costs KRW 60,000 will be incurred as round island charge.

Let us know if you need airport sending and pick up services on the tour date and it's free of charge.

Please provide the exact number of passengers and luggages when you make your booking.

Our staff will contact you via WhatsApp the day before the tour date, if you didn't receive our message until 8pm, please contact us.

Leave a WhatsApp number will make your tour easier.

Free cancellation: Cancel up to 24 hours in advance for a full refund.`,
    
    highlights: [
      "Comfortable feeling that you can't be felt in a group tour",
      "With over 10-years experienced professional driver-guides will company you",
      "Provide hotel pick-up and drop off service, put aside all the hassle",
      "Visit Jeju UNESCO sites and hidden gems with ease"
    ],
    
    includes: [
      "Hotel pick up and drop off",
      "Private vehicle (air-conditioned, spacious)",
      "Chinese/English Professional speaking driver-guide",
      "Fuel fees",
      "Toll fees",
      "Parking fees",
      "Tax",
      "Airport pickup and drop-off (on tour date, free)"
    ],
    
    excludes: [
      "Admissions to attractions",
      "Meals and beverages",
      "Tips",
      "Personal travel insurance"
    ],
    
    schedule: [
      {
        time: "09:00",
        title: "Hotel Pickup",
        description: "Please wait in the hotel lobby 10 minutes before your scheduled pickup time. Tour start time can be adjusted upon request."
      },
      {
        time: "09:00-18:00",
        title: "Customized Tour (Choose Your Route)",
        description: "Eastern Route: Udo Island, Seongsan Ilchulbong Peak, Jeju Aquarium Planet, Cape Seokjikoji, Seongeup Folk Village, ECO Land Theme Park, Sangumburi Crater, Manjanggul cave, Hamdeok Beach, Ilchul Land, Bijarim Forest, Nanta show. Western Route: Aewol Seaside Cafe, Hyeopjae Beach, Hallim Park, Green Tea Field. Southern Route: Cheonjiyeon waterfall, Yak-cheon-sa Temple, Seogwipo Maeil Olle Market, Columnar Joint, Jeongbang Waterfall, Camellia hill, Teddy Bear Safari, Sanbangsan Mountain, Marado submarine, Songaksan Mountain, Cafe the Cliff, 4D Alive Museum, Jeju Speed boat, Dolphin Yachat tour."
      },
      {
        time: "13:00",
        title: "Lunch (Optional)",
        description: "Enjoy local Jeju specialties at a local restaurant. Meal costs are separate."
      },
      {
        time: "18:00",
        title: "Hotel Drop-off",
        description: "Safe drop-off at your hotel after the tour ends."
      }
    ],
    
    faqs: [
      {
        question: "What are the advantages of a private tour?",
        answer: "Unlike group tours, you can travel freely with your own schedule and spend enough time at places you want to visit. With a professional driver-guide, you can enjoy Jeju comfortably without worrying about transportation or finding directions."
      },
      {
        question: "Can I change the tour time?",
        answer: "Yes, the tour start time can be adjusted according to your request. Please let us know your preferred time when booking."
      },
      {
        question: "What areas can I visit?",
        answer: "You can visit all areas of Jeju including Eastern, Western, and Southern routes. For efficient time management, we recommend visiting one area per day (choose from Eastern/Western/Southern)."
      },
      {
        question: "What happens if we exceed 9 hours?",
        answer: "An overtime charge of 25,000 won per hour applies if the vehicle is used over 9 hours, payable in cash to the driver."
      },
      {
        question: "Can I visit multiple areas in one day?",
        answer: "Yes, but it takes a lot of time. Visiting multiple areas in one day incurs an extra KRW 60,000 'round island charge'."
      },
      {
        question: "Is airport pickup available?",
        answer: "Yes, airport pickup and drop-off services on the tour date are free of charge. Please let us know when booking."
      },
      {
        question: "What is the cancellation policy?",
        answer: "Cancel up to 24 hours in advance for a full refund. For example, if your tour is on January 1 at 09:00, cancel before December 31 at 09:00 for a full refund."
      },
      {
        question: "When will I be contacted after booking?",
        answer: "Our staff will contact you via WhatsApp the day before the tour date by 8 pm. If you don't receive a message, please contact us. Providing a WhatsApp number is recommended for easier communication."
      },
      {
        question: "Are admission fees and meals included?",
        answer: "Admission fees and meals are not included. You need to pay separately for attraction entrance fees and meal costs."
      },
      {
        question: "Is pickup available from areas outside Jeju City?",
        answer: "Yes. Pickup from areas outside Jeju City (Seogwipo, Aewol, Hanlim, Seongsan, etc.) may incur additional fees. Please let us know your pickup location when booking for accurate pricing."
      }
    ],
    
    pickup_points: [
      {
        name: "Pickup within Jeju Downtown Area",
        address: "Within 6km from Jeju Airport (e.g., Nohyeong-dong or Yeon-dong)",
        lat: 33.4996,
        lng: 126.5312,
        pickup_time: "09:00"
      },
      {
        name: "Pickup outside of Jeju City",
        address: "Seogwipo, Aewol, Hanlim, Seongsan, Hangyeong, Jochon, Pyoseon, Namwon, Andeok, Daejeong, etc.",
        lat: 33.2500,
        lng: 126.5600,
        pickup_time: "09:00"
      }
    ],
    
    badges: ["Top rated", "Free cancellation"],
    rating: 4.8,
    review_count: 154,
    pickup_points_count: 2,
    dropoff_points_count: 1,
    is_active: true,
    is_featured: true
  };
  
  console.log('🚀 프라이빗 투어 새로 생성 시작...');
  console.log('📦 투어 제목:', tourData.title);
  console.log('🏷️  Slug (새로 생성):', tourData.slug);
  console.log('⭐ 평점:', tourData.rating, '(', tourData.review_count, 'reviews)');
  console.log('💰 기본 가격 (6명 기준, 제주 시내 픽업):', basePrice.toLocaleString(), '원');
  console.log('💰 시외 픽업 가격 (6명 기준):', originalPrice.toLocaleString(), '원');
  console.log('📸 메인 썸네일 (5번째 사진 - Black minivan on coastal road):', tourData.image_url);
  console.log('📸 갤러리 사진 개수:', tourData.gallery_images.length, '장');
  console.log('📸 갤러리 사진 목록:');
  tourData.gallery_images.forEach((img, index) => {
    console.log(`   ${index + 1}. ${img}`);
  });
  console.log('📋 Highlights:', tourData.highlights.length, '개');
  console.log('📋 Includes:', tourData.includes.length, '개');
  console.log('📋 Excludes:', tourData.excludes.length, '개');
  console.log('📋 FAQs:', tourData.faqs.length, '개');
  
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    
    console.log('✅ Authorization 헤더 설정 완료');
    
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
    
    console.log('✅ 투어 생성 성공!');
    console.log('📋 생성된 투어 ID:', result.data?.id);
    console.log('🔗 투어 링크:', `/tour/${result.data?.slug || result.data?.id}`);
    console.log('📊 생성된 투어 정보:', result.data);
    
    return result.data;
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    throw error;
  }
})();

