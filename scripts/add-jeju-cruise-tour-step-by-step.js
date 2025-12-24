// 단계별 실행 버전 - 보안 경고 우회
// 각 단계를 하나씩 복사해서 실행하세요

// ============================================
// STEP 1: 투어 데이터 정의 (먼저 실행)
// ============================================
const tourData = {
  title: "Jeju Island: Full Day Tour for Cruise Ship Passengers",
  slug: "jeju-island-full-day-tour-cruise-passengers",
  city: "Jeju",
  price: 88000,
  price_type: "person",
  image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
  tag: "Cruise",
  subtitle: "Top rated",
  description: "Exclusive Jeju tour for cruise guests. Pickup & drop-off strictly on time at the cruise terminal. Two itineraries are available for Jeju's two ports, with full details in the description. Welcome to all cruise passengers visiting Jeju Island! This tour is specifically designed for travelers arriving in Jeju by cruise ship for a layover (port stop, stopover). Although the tour time is set at 8:00 AM on the product page, booking is flexible regardless of arrival time. Pickup is arranged based on the cruise ship's schedule to ensure return to the port well before departure.",
  original_price: 88000,
  gallery_images: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop"
  ],
  duration: "8 hours",
  lunch_included: false,
  ticket_included: true,
  pickup_info: "We will be waiting for you according to the cruise ship's schedule (regardless of the arrival time). Please make sure to select the correct port where your cruise ship will dock. Our guide will be waiting for you in front of the gate where you disembark from the cruise ship, holding a sign that says \"LOVE KOREA.\" There are two ports in Jeju Island: Jeju Port and Gangjeong Seogwipo Port. Pickup and drop-off times are scheduled to match the cruise ship's arrival and departure times (06:00~22:00). Pick-up time at 08:00 am is arbitrarily set. You will be picked up when your cruise arrives at the port (can be changed at any time). Please let us know the name of your cruise ship and your arrival time. Also, make sure to provide a WhatsApp number where we can reach you.",
  notes: "Tour time may change depending on cruise arrival and departure times. Tour schedule may be reduced or changed on site (due to limited time). Please let me know the cruise arrival time. For Private Car option: You can customize the day and destinations. Entrance fees are not included in the private car option. Two itineraries are available depending on Jeju's cruise port: For departures from \"Jeju Port\": Seongsan Ilchulbong, Seopjikoji, Seongeup Folk Village, and Dongmun Market. For departures from \"Seogwipo Gangjeong Port\": Hallasan Mountain, Cheonjiyeon Waterfall, Jusangjeolli Cliffs, and Olle Market. The tour duration and number of attractions can be adjusted based on the cruise's stay in Jeju.",
  highlights: [
    "Tailored tours for cruise guests with on-time pick-up & drop-off guaranteed",
    "Enjoy a seamless tour aligned with cruise schedules from arrival to departure",
    "Discover Jeju's UNESCO sites, vibrant markets, and hidden local gems in comfort",
    "Certified guides and spacious vehicles ensure a safe and memorable journey",
    "Two itineraries available depending on Jeju's cruise port, flexible and easy"
  ],
  includes: [
    "Professional guide",
    "Cruise port pickup and drop-off",
    "Comfortable vehicle",
    "Admission fees (for group tours only)"
  ],
  excludes: [
    "Lunch costs",
    "Personal expenses",
    "Tips",
    "Personal travel insurance",
    "Admission fees (for Private car option)"
  ],
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
  rating: 4.8,
  review_count: 138,
  pickup_points_count: 2,
  dropoff_points_count: 2,
  is_active: true,
  is_featured: true
};

// ============================================
// STEP 2: API 호출 함수 (STEP 1 실행 후 실행)
// ============================================
async function createTour() {
  try {
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(tourData)
    });
    const result = await response.json();
    if (result.data) {
      console.log('✅ 투어 생성 성공!', result.data);
      console.log(`🌐 투어 확인: /tour/${result.data.slug}`);
      alert('✅ 투어 생성 성공!\n\n투어 ID: ' + result.data.id + '\n제목: ' + result.data.title);
      return result.data;
    } else {
      console.error('❌ 투어 생성 실패:', result.error);
      alert('❌ 투어 생성 실패: ' + (result.error || 'Unknown error'));
      return null;
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    return null;
  }
}

// ============================================
// STEP 3: 실행 (STEP 2 실행 후 실행)
// ============================================
// createTour();


