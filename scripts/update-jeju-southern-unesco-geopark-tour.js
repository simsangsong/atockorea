// ============================================
// Jeju: Southern UNESCO Geopark Day Tour 업데이트 스크립트
// ============================================
// 브라우저 콘솔에서 실행
// 이미 존재하는 투어를 업데이트합니다

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
  
  const tourSlug = 'jeju-southern-unesco-geopark-day-tour';
  
  // 업데이트할 투어 데이터
  const updateData = {
    // ===== 기본 정보 =====
    title: "Jeju: Southern UNESCO Geopark Day Tour",
    description: "Enjoy a comfortable bus tour of the UNESCO area of Jeju Island. Visit Hallasan Mountain, the O'sulloc Tea Museum, the Jusangjeolli Cliff, and the Cheonjiyeon Waterfall. Discover UNESCO Jeju South - One Perfect Day of Beauty and Wonder. Experience Jeju's UNESCO Treasures in Comfort: an all-inclusive one-day tour through the UNESCO-designated southern region of Jeju Island. This journey combines breathtaking scenery, cultural heritage, and natural wonders with ease, comfort, and convenience. Licensed guides, air-conditioned vehicles, and admission fees included.",
    price: 80000,
    original_price: 80000,
    image_url: "/images/tours/jeju-southern-unesco-snow-road.png",
    
    // ===== 이미지 =====
    gallery_images: [
      "/images/tours/jeju-southern-unesco-snow-road.png",
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop"
    ],
    
    // ===== 투어 정보 =====
    duration: "10 hours",
    lunch_included: false,
    ticket_included: true,
    
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
    
    is_active: true,
    is_featured: true
  };
  
  try {
    console.log('🔍 투어 검색 중...');
    console.log(`📋 Slug: ${tourSlug}\n`);
    
    // 1. 먼저 투어 찾기
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
    
    // slug로 투어 찾기
    const tour = listResult.data.find((t) => t.slug === tourSlug);
    
    if (!tour) {
      console.error('❌ 투어를 찾을 수 없습니다.');
      console.log('💡 사용 가능한 투어 목록:');
      listResult.data.forEach((t) => {
        console.log(`   - ${t.title} (ID: ${t.id}, slug: ${t.slug})`);
      });
      return;
    }
    
    console.log('✅ 투어 찾음!');
    console.log(`   제목: ${tour.title}`);
    console.log(`   ID: ${tour.id}`);
    console.log(`   Slug: ${tour.slug}`);
    console.log(`   현재 가격: ₩${tour.price.toLocaleString()}\n`);
    
    // 2. 업데이트 실행
    console.log('🔄 투어 업데이트 중...');
    console.log('📝 업데이트할 데이터:');
    console.log(`   - 이미지 URL: ${updateData.image_url}`);
    console.log(`   - 가격: ₩${updateData.price.toLocaleString()}`);
    console.log(`   - 갤러리 이미지: ${updateData.gallery_images.length}개`);
    console.log(`   - 일정: ${updateData.schedule.length}개`);
    console.log('');
    
    const updateResponse = await fetch(`/api/tours/${tour.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    
    console.log(`응답 상태: ${updateResponse.status} ${updateResponse.statusText}\n`);
    
    const updateResult = await updateResponse.json();
    
    if (updateResponse.ok && updateResult.success) {
      console.log('✅ 투어 업데이트 성공!');
      console.log('📋 업데이트된 투어 정보:');
      console.log(`   ID: ${updateResult.data.id}`);
      console.log(`   제목: ${updateResult.data.title}`);
      console.log(`   가격: ₩${updateResult.data.price.toLocaleString()}`);
      console.log(`   이미지: ${updateResult.data.image_url}`);
      console.log('');
      console.log(`🌐 투어 확인: /tour/${updateResult.data.slug}`);
      alert('✅ 투어 업데이트 성공!');
      return updateResult.data;
    } else {
      console.error('❌ 투어 업데이트 실패');
      console.error('에러:', updateResult.error || updateResult);
      alert('❌ 업데이트 실패: ' + (updateResult.error || 'Unknown error'));
      throw new Error(updateResult.error || 'Failed to update tour');
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
    throw error;
  }
})();
