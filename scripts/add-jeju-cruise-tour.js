/**
 * Jeju Island: Full Day Tour for Cruise Ship Passengers
 * API를 사용하여 투어 추가 스크립트
 * 
 * 사용법:
 * 1. 로컬 개발 서버 실행 중이어야 함 (npm run dev)
 * 2. 브라우저에서 로그인하여 admin 권한 획득
 * 3. 이 스크립트 실행: node scripts/add-jeju-cruise-tour.js
 * 
 * 또는 cURL로 직접 호출:
 * curl -X POST http://localhost:3000/api/admin/tours \
 *   -H "Content-Type: application/json" \
 *   -H "Cookie: your-session-cookie" \
 *   -d @tour-data.json
 */

const tourData = {
  // ===== 필수 필드 =====
  title: "Jeju Island: Full Day Tour for Cruise Ship Passengers",
  slug: "jeju-island-full-day-tour-cruise-passengers",
  city: "Jeju",
  price: 88000,
  price_type: "person",
  image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
  
  // ===== 기본 정보 =====
  tag: "Cruise",
  subtitle: "Top rated",
  description: "Exclusive Jeju tour for cruise guests. Pickup & drop-off strictly on time at the cruise terminal. Two itineraries are available for Jeju's two ports, with full details in the description. Welcome to all cruise passengers visiting Jeju Island! This tour is specifically designed for travelers arriving in Jeju by cruise ship for a layover (port stop, stopover). Although the tour time is set at 8:00 AM on the product page, booking is flexible regardless of arrival time. Pickup is arranged based on the cruise ship's schedule to ensure return to the port well before departure.",
  original_price: 88000,
  
  // ===== 이미지 =====
  gallery_images: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop"
  ],
  
  // ===== 투어 상세 정보 =====
  duration: "8 hours",
  lunch_included: false,
  ticket_included: true,
  pickup_info: "We will be waiting for you according to the cruise ship's schedule (regardless of the arrival time). Please make sure to select the correct port where your cruise ship will dock. Our guide will be waiting for you in front of the gate where you disembark from the cruise ship, holding a sign that says \"LOVE KOREA.\" There are two ports in Jeju Island: Jeju Port and Gangjeong Seogwipo Port. Pickup and drop-off times are scheduled to match the cruise ship's arrival and departure times (06:00~22:00). Pick-up time at 08:00 am is arbitrarily set. You will be picked up when your cruise arrives at the port (can be changed at any time). Please let us know the name of your cruise ship and your arrival time. Also, make sure to provide a WhatsApp number where we can reach you.",
  notes: "Tour time may change depending on cruise arrival and departure times. Tour schedule may be reduced or changed on site (due to limited time). Please let me know the cruise arrival time. For Private Car option: You can customize the day and destinations. Entrance fees are not included in the private car option. Two itineraries are available depending on Jeju's cruise port: For departures from \"Jeju Port\": Seongsan Ilchulbong, Seopjikoji, Seongeup Folk Village, and Dongmun Market. For departures from \"Seogwipo Gangjeong Port\": Hallasan Mountain, Cheonjiyeon Waterfall, Jusangjeolli Cliffs, and Olle Market. The tour duration and number of attractions can be adjusted based on the cruise's stay in Jeju.",
  
  // ===== 하이라이트 =====
  highlights: [
    "Tailored tours for cruise guests with on-time pick-up & drop-off guaranteed",
    "Enjoy a seamless tour aligned with cruise schedules from arrival to departure",
    "Discover Jeju's UNESCO sites, vibrant markets, and hidden local gems in comfort",
    "Certified guides and spacious vehicles ensure a safe and memorable journey",
    "Two itineraries available depending on Jeju's cruise port, flexible and easy"
  ],
  
  // ===== 포함 사항 =====
  includes: [
    "Professional guide",
    "Cruise port pickup and drop-off",
    "Comfortable vehicle",
    "Admission fees (for group tours only)"
  ],
  
  // ===== 불포함 사항 =====
  excludes: [
    "Lunch costs",
    "Personal expenses",
    "Tips",
    "Personal travel insurance",
    "Admission fees (for Private car option)"
  ],
  
  // ===== 일정표 =====
  schedule: [
    {
      time: "Variable",
      title: "Pickup - Cruise Terminal",
      description: "Pickup at cruise terminal according to cruise ship schedule. Two ports available: Jeju Port or Seogwipo Gangjeong Cruise Terminal. Our guide will be waiting in front of the gate where you disembark, holding a \"LOVE KOREA\" sign. Pickup time: 06:00~22:00 (matches cruise arrival time)."
    },
    {
      time: "Variable",
      title: "Itinerary A: For Jeju Port Departures",
      description: "Seongsan Ilchulbong (Sightseeing, 2 hours) - UNESCO World Natural Heritage site, iconic volcanic tuff cone. Seopjikoji (Guided tour, Sightseeing, Walk, 1.5 hours) - Beautiful coastal area with scenic views. Seongeup Folk Village (Guided tour, Walk, 1 hour) - Well-preserved traditional village. Dongmun Traditional Market (Free time, 1 hour) - Vibrant local market."
    },
    {
      time: "Variable",
      title: "Itinerary B: For Seogwipo Gangjeong Port Departures",
      description: "Hallasan National Park (Guided tour, Sightseeing, Walk, 1.5 hours) - South Korea's highest mountain, UNESCO World Heritage Site. Cheonjiyeon Waterfall (Sightseeing, 1.5 hours) - \"The Pond of the Gods,\" three graceful tiers. Jusangjeollidae (Sightseeing, 1.5 hours) - Dramatic hexagonal lava cliffs, Natural Monument No. 443. Seogwipo Olle Market (Sightseeing, 1.5 hours) - Local market with fresh produce and local specialties."
    },
    {
      time: "Variable",
      title: "Lunch",
      description: "Lunch at local restaurant (Optional, at your own expense). Please inform us in advance about any dietary restrictions."
    },
    {
      time: "Variable",
      title: "Drop-off - Cruise Terminal",
      description: "Return to cruise terminal (Jeju Port or Seogwipo Gangjeong Cruise Terminal). Drop-off time is scheduled to match cruise ship departure time, ensuring return well before departure."
    }
  ],
  
  // ===== FAQ =====
  faqs: [
    {
      question: "Which port will my cruise dock at?",
      answer: "There are two ports in Jeju Island: Jeju Port and Gangjeong Seogwipo Port. Please make sure to select the correct port where your cruise ship will dock when booking."
    },
    {
      question: "What time will I be picked up?",
      answer: "Pickup is arranged based on your cruise ship's schedule. Although the tour time is set at 8:00 AM on the product page, you will be picked up when your cruise arrives at the port (can be changed at any time). Pickup times are scheduled between 06:00~22:00 to match cruise arrival times."
    },
    {
      question: "Will we return in time for departure?",
      answer: "Yes, pickup and drop-off times are scheduled to match the cruise ship's arrival and departure times. We guarantee return to the port well before departure."
    },
    {
      question: "Are admission fees included?",
      answer: "Admission fees are included for group tours only. For Private Car option, admission fees are not included."
    },
    {
      question: "Is lunch included?",
      answer: "No, lunch costs are not included. Lunch is available at local restaurants at your own expense. Please inform us in advance about any dietary restrictions."
    },
    {
      question: "How do I contact you?",
      answer: "Please let us know the name of your cruise ship and your arrival time. Also, make sure to provide a WhatsApp number where we can reach you. You can get a faster response using WhatsApp."
    },
    {
      question: "Can the itinerary change?",
      answer: "Yes, tour time may change depending on cruise arrival and departure times. Tour schedule may be reduced or changed on site due to limited time. The tour duration and number of attractions can be adjusted based on the cruise's stay in Jeju."
    },
    {
      question: "What is the difference between group tour and private car?",
      answer: "For group tours, admission fees are included. For Private Car option, you can customize the day and destinations, but entrance fees are not included."
    }
  ],
  
  // ===== 픽업 지점 =====
  pickup_points: [
    {
      name: "Seogwipo Gangjeong Cruise Terminal",
      address: "Seogwipo Gangjeong Cruise Terminal, Gangjeong-dong, Seogwipo-si, Jeju-do",
      lat: 33.2375,
      lng: 126.5778,
      pickup_time: null
    },
    {
      name: "Port of Jeju",
      address: "Port of Jeju, Jeju-si, Jeju-do",
      lat: 33.5148,
      lng: 126.5270,
      pickup_time: null
    }
  ],
  
  // ===== 메타데이터 =====
  rating: 4.8,
  review_count: 138,
  pickup_points_count: 2,
  dropoff_points_count: 2,
  is_active: true,
  is_featured: true
};

// API 호출 함수
async function createTour() {
  const apiUrl = process.env.API_URL || 'http://localhost:3000';
  const endpoint = `${apiUrl}/api/admin/tours`;
  
  console.log('🚀 투어 추가 시작...');
  console.log(`📡 API 엔드포인트: ${endpoint}`);
  console.log(`📦 투어 제목: ${tourData.title}`);
  console.log(`🏷️  Slug: ${tourData.slug}`);
  console.log('');
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 쿠키 포함 (브라우저에서 실행 시)
      body: JSON.stringify(tourData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 투어 생성 성공!');
      console.log('');
      console.log('📋 생성된 투어 정보:');
      console.log(`   ID: ${result.data.id}`);
      console.log(`   제목: ${result.data.title}`);
      console.log(`   Slug: ${result.data.slug}`);
      console.log(`   가격: ₩${result.data.price.toLocaleString()}`);
      console.log(`   도시: ${result.data.city}`);
      console.log(`   픽업 지점 수: ${result.data.pickup_points_count || tourData.pickup_points.length}`);
      console.log('');
      console.log('🌐 투어 확인:');
      console.log(`   ${apiUrl}/tour/${result.data.slug}`);
      console.log(`   ${apiUrl}/tour/${result.data.id}`);
      return result.data;
    } else {
      console.error('❌ 투어 생성 실패');
      console.error(`   에러: ${result.error || 'Unknown error'}`);
      if (result.details) {
        console.error(`   상세: ${JSON.stringify(result.details, null, 2)}`);
      }
      throw new Error(result.error || 'Failed to create tour');
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error.message);
    if (error.message.includes('fetch')) {
      console.error('');
      console.error('💡 해결 방법:');
      console.error('   1. 로컬 개발 서버가 실행 중인지 확인하세요 (npm run dev)');
      console.error('   2. 브라우저에서 로그인하여 admin 권한을 획득하세요');
      console.error('   3. 브라우저 콘솔에서 이 스크립트를 실행하거나,');
      console.error('   4. cURL을 사용하여 직접 API를 호출하세요');
      console.error('');
      console.error('📝 cURL 예시:');
      console.error(`   curl -X POST ${endpoint} \\`);
      console.error(`     -H "Content-Type: application/json" \\`);
      console.error(`     -H "Cookie: your-session-cookie" \\`);
      console.error(`     -d '${JSON.stringify(tourData)}'`);
    }
    throw error;
  }
}

// Node.js 환경에서 실행 시
if (typeof window === 'undefined') {
  // Node.js 환경
  const fetch = require('node-fetch');
  
  console.log('⚠️  Node.js 환경에서 실행 중입니다.');
  console.log('⚠️  인증이 필요하므로 브라우저 콘솔에서 실행하는 것을 권장합니다.');
  console.log('');
  console.log('💡 브라우저에서 실행하는 방법:');
  console.log('   1. 로컬 개발 서버 실행 (npm run dev)');
  console.log('   2. 브라우저에서 로그인하여 admin 권한 획득');
  console.log('   3. 브라우저 콘솔에서 다음 코드 실행:');
  console.log('');
  console.log('   fetch("/api/admin/tours", {');
  console.log('     method: "POST",');
  console.log('     headers: { "Content-Type": "application/json" },');
  console.log('     credentials: "include",');
  console.log('     body: JSON.stringify(' + JSON.stringify(tourData, null, 2) + ')');
  console.log('   }).then(r => r.json()).then(console.log)');
  console.log('');
  
  // 환경 변수로 세션 쿠키가 제공된 경우에만 실행
  if (process.env.SESSION_COOKIE) {
    createTour().catch(console.error);
  } else {
    console.log('💡 또는 SESSION_COOKIE 환경 변수를 설정하여 실행:');
    console.log('   SESSION_COOKIE="your-cookie" node scripts/add-jeju-cruise-tour.js');
  }
} else {
  // 브라우저 환경
  createTour().catch(console.error);
}

// 브라우저에서 직접 사용할 수 있도록 export
if (typeof window !== 'undefined') {
  window.createJejuCruiseTour = createTour;
  window.jejuCruiseTourData = tourData;
}
