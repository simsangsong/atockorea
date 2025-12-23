// ============================================
// Add Jeju: Southern UNESCO Geopark Day Tour
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
    title: "제주 남부 유네스코 지질공원 투어",
    slug: "jeju-southern-unesco-geopark-day-tour",
    city: "Jeju",
    price: 80000,
    price_type: "person",
    image_url: "/images/tours/jeju-southern-unesco-snow-road.png",
    
    // ===== 선택 필드 =====
    tag: "UNESCO",
    subtitle: "Top rated",
    description: "제주 남부의 유네스코 지질공원을 편안한 버스 투어로 탐방하세요. 한라산, 오설록 차 박물관, 주상절리대, 천지연폭포를 방문합니다. 모든 입장권과 가이드가 포함되어 있습니다.",
    original_price: 80000,
    duration: "10 hours",
    lunch_included: false,
    ticket_included: true,
    
    gallery_images: [
      "/images/tours/jeju-southern-unesco-snow-road.png",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop"
    ],
    
    pickup_info: "**Pick up information:** 1.Ocean Suites Jeju 08:30, 2.Jeju Airport Gate 1st Floor at 8:45, 3.Lotte city Hotel jeju 08:55, 4.Shilla Duty-Free Jeju Store at 09:05. A guide or vehicle holding a LOVE KOREA sign will be waiting for you at the designated location. Please arrive at least 10 minutes early. Thank you! Once your reservation is confirmed, we will contact you one day before the tour with detailed information about pick-up, vehicle, and guide via Whatsapp. If you have WhatsApp, we can conveniently create a group chat there. If you haven't received any contact, please install WhatsApp or contact us via WhatsApp.",
    
    notes: "Relax. Explore. Fall in Love with Jeju. Discover the heart of Jeju's UNESCO heritage with us — a perfect blend of culture, nature, and comfort. Book now and experience why travelers around the world fall in love with the southern beauty of Jeju Island. We recommend that you bring personal travel insurance. Outdoor activities involve various risks and dangers. Tour ending time may vary based on traffic or weather.",
    
    highlights: [
      "Discover Jeju's UNESCO wonders — World Heritage, Biosphere Reserve, Geopark",
      "Hike Hallasan's Eoseungsangak Trail and feel Jeju's calm volcanic beauty",
      "Relax at O'sulloc Tea Museum with vast green tea fields and gentle scenery",
      "Marvel at Jusangjeolli Cliff's hexagonal lava pillars and dramatic coast",
      "End at Cheonjiyeon Falls, where sky and land meet in peaceful harmony"
    ],
    
    includes: [
      "Admission fees: all",
      "Parking Fees",
      "Air-conditioned vehicle",
      "Licensed guides",
      "Convenient pickup and drop-off"
    ],
    
    excludes: [
      "Lunch (Meal)",
      "Personal Expenses",
      "Personal travel insurance"
    ],
    
    schedule: [
      {
        time: "08:30",
        title: "Pickup - Ocean Suites Jeju",
        description: "First pickup point. A guide or vehicle holding a LOVE KOREA sign will be waiting for you. Please arrive at least 10 minutes early."
      },
      {
        time: "08:45",
        title: "Pickup - Jeju Airport Gate 1st Floor",
        description: "Second pickup point at Jeju Airport Gate 1st Floor."
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
        time: "09:30-10:30",
        title: "Eoseungsaengak Trail - Hike Hallasan",
        description: "Start your day with a peaceful hike on the Eoseungsaengak Trail, one of Hallasan Mountain's most scenic and beginner-friendly routes. Duration: about 40 minutes to 1.2 hours. Experience the fresh air and beauty of Jeju's volcanic nature. Hallasan is a UNESCO World Heritage Site. Guided tour, Sightseeing, Walk."
      },
      {
        time: "11:00-11:30",
        title: "Camellia Hill Botanical Garden - Jeju's Garden of Blossoms",
        description: "Home to over 6,000 camellia trees from around the world. Blooms in red, pink, and white from November to April. Symbolizes love and warmth in winter. A peaceful garden with scenic paths, a must-visit for nature and photo lovers. Sightseeing."
      },
      {
        time: "12:30-13:30",
        title: "Lunch at Local Restaurant",
        description: "Enjoy authentic Korean dishes at a local restaurant. Optional, Extra fee. Lunch (1 hour)."
      },
      {
        time: "14:00-14:30",
        title: "Cheonjeyeon Falls - The Pond of the Gods",
        description: "Known as \"The Pond of the Gods,\" this waterfall features three graceful tiers surrounded by lush forest and unique rock formations. The clear water from Hallasan creates a calm, sacred atmosphere. Seonimgyo Bridge with its seven nymph carvings adds mythical charm. Sightseeing."
      },
      {
        time: "15:00-15:30",
        title: "Jusangjeolli Cliff - Nature's Volcanic Masterpiece",
        description: "Dramatic Jusangjeolli Hexagonal Cliffs formed by cooling lava. Features towering 30-40 meter columns, struck by waves soaring over 20 meters high. Creates one of Korea's most spectacular coastal views. Recognized as Natural Monument No. 443 and a must-see highlight of Jeju's UNESCO Geopark. Photo stop, Guided tour."
      },
      {
        time: "16:00-17:00",
        title: "O'sulloc Tea Museum - Taste Jeju's Green Serenity",
        description: "O'sulloc Tea Museum and Innisfree House. Vast green tea fields stretch across the horizon. Taste freshly brewed green tea, explore the museum's exhibits, and discover the art of Jeju's tea culture. A perfect place to rest, sip, and take beautiful photos. Visit, Guided tour, Sightseeing."
      },
      {
        time: "17:30",
        title: "Shilla Duty Free Jeju Store (Optional)",
        description: "Hop-on Hop-off stop. Optional stop for shopping. (2 minutes)"
      },
      {
        time: "18:00+",
        title: "Drop-off at 5 locations",
        description: "1. Shilla Duty Free Jeju, 2. LOTTE City Hotel Jeju, 3. Jeju Airport (CJU), 4. Ocean Suites Jeju Hotel, 5. Jeju Dongmun Traditional Market (Self-Guided, Jeju's most popular and vibrant market, loved by travelers!)"
      }
    ],
    
    faqs: [
      {
        question: "Is lunch included?",
        answer: "No, lunch is not included. Lunch will be at a local restaurant at your own expense (Optional, Extra fee)."
      },
      {
        question: "Are admission fees included?",
        answer: "Yes, all admission fees are included in the tour price."
      },
      {
        question: "What should I bring?",
        answer: "Comfortable shoes are recommended. We also recommend that you bring personal travel insurance as outdoor activities involve various risks and dangers."
      },
      {
        question: "Is the tour suitable for wheelchair users?",
        answer: "No, this tour is not suitable for wheelchair users or people with low level of fitness."
      },
      {
        question: "Can I cancel my booking?",
        answer: "Yes, you can cancel up to 24 hours in advance for a full refund."
      },
      {
        question: "When will I receive tour information?",
        answer: "Once your reservation is confirmed, we will contact you one day before the tour with detailed information about pick-up, vehicle, and guide via WhatsApp. If you have WhatsApp, we can conveniently create a group chat there."
      },
      {
        question: "What is included in the tour?",
        answer: "Admission fees (all), parking fees, air-conditioned vehicle, and licensed guides are included. Lunch, personal expenses, and personal travel insurance are not included."
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
        name: "Jeju Airport Gate 1st Floor",
        address: "Jeju International Airport, Gate 1st Floor, 2 Gonghang-ro, Jeju-si, Jeju-do",
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
    
    rating: 5.0,
    review_count: 62,
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


