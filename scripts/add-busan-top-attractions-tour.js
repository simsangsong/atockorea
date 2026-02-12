// ============================================
// Add Busan: Top Attractions Authentic One-Day Guided Tour
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
  
  console.log('🚀 부산 투어 추가 시작...');
  console.log('');
  
  // 투어 데이터 생성
  const timestamp = Date.now();
  const newSlug = `busan-top-attractions-authentic-one-day-guided-tour-${timestamp}`;
  
  // €35를 원화로 변환 (대략 50,000원, 실제 환율에 맞게 조정 필요)
  const priceInWon = 50000; // €35 ≈ 50,000원
  const originalPriceInWon = 55000; // €39 ≈ 55,000원
  
  const tourData = {
    // ===== 필수 필드 =====
    title: "Busan: Top Attractions Authentic One-Day Guided Tour",
    slug: newSlug,
    city: "Busan",
    price: priceInWon,
    price_type: "person",
    image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80", // 임시 이미지, 실제 이미지로 교체 필요
    
    // ===== 선택 필드 =====
    tag: "Busan · Day tour",
    subtitle: "Top rated",
    description: `If you only have one day in Busan, this is the tour you've been waiting for. No complicated choices, no confusing options—unlike other tours, we offer just one carefully designed itinerary. It's simple, easy, and guaranteed to show you the very best of Busan.

From majestic temples by the sea to colorful hillside villages, from skywalks over the ocean to bustling markets, this day tour combines Busan's most iconic sights with hidden local gems.

All entrance fees are included (Sky Capsule is optional), transportation is comfortable and spotless, and your licensed guide speak English making your journey smooth, fun, and deeply insightful.`,
    
    original_price: originalPriceInWon,
    duration: "9.5 hours",
    lunch_included: false,
    ticket_included: true,
    
    gallery_images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop"
    ],
    
    pickup_info: `Pickup Times/Locations:
• 08:30 Busan Subway Station (Exit 4) Not KTX gate
• 08:50 Seomyeon Subway Station (Exit 4)
• 09:30 Haeundae Subway Station (Exit 5)

Return: Central Busan with a special drop-off option at Nampo-dong & Jagalchi Market.

Tour Ending Time Note: The tour ending time may vary each day depending on traffic, rush hour conditions, weather, and guest cooperation.

Official Drop-off Times:
• Officially, the first drop-off (Nampo-dong & Jagalchi Station) is at 17:50.
• Busan Station: 18:00
• Seomyeon Station: 18:20
• Haeundae Station: 19:00

Post-Tour Exploration: At the end of the day, we'll even drop you off in Nampo-dong & Jagalchi Market, where you can explore like a local. Wander Yongdusan Park, savor street foods in Gukje and Bupyeong Markets, or enjoy the freshest seafood at Jagalchi—perfect if you're staying nearby or just want to keep the adventure going.`,
    
    notes: `Important Information - Know before you go:

Please leave accurate contact information so we can reach you for a smooth tour (we will contact you via WhatsApp).

The time spent at each attraction may change, or locations may be substituted due to local weather and traffic conditions.

Please inform us in advance about any dietary restrictions, allergies, etc.

Free cancellation: Cancel up to 24 hours in advance for a full refund.

Reserve now & pay later: Keep your travel plans flexible — book your spot and pay nothing today.`,
    
    highlights: [
      "Explore Busan's must-see spots in one simple, all-inclusive day tour",
      "Certified professional guide who speaks English",
      "End your tour with a special drop-off at Nampo-dong & Jagalchi Market",
      "Visit Haedong Yonggungsa, Gamcheon Village, and hidden coastal gems",
      "Exceptional value without compromise"
    ],
    
    includes: [
      "Admission to attractions",
      "Chinese / English-speaking guide",
      "Professional guide",
      "Round-trip transfers to and from the meet up location",
      "Toll fees",
      "Parking fees",
      "Fuel fees"
    ],
    
    excludes: [
      "Meals and beverages",
      "Other personal expenses",
      "Lunch fees",
      "Personal Insurance",
      "Sky Capsule & Beach Train Ticket (on-site)"
    ],
    
    schedule: [
      {
        time: "08:30-09:30",
        title: "Pickup Locations",
        description: "3 pickup location options: Busan Station, Haeundae Station Exit 5, Seomyeon-Yeog"
      },
      {
        time: "10:00",
        title: "Yonggungsa Temple",
        description: "Visit, Sightseeing (80 minutes) - Start your morning at Busan's famous seaside temple, a rare and breathtaking place where culture meets the ocean."
      },
      {
        time: "11:30",
        title: "Cheongsapo Daritdol Observatory",
        description: "Visit, Sightseeing (30 minutes) - Walk above the waves on a glass-bottom bridge with panoramic coastal views."
      },
      {
        time: "12:30",
        title: "Local restaurant",
        description: "Lunch (1 hour) Optional - Recharge with a delicious local meal. Vegetarian, vegan, and special menus are available—just let us know in advance. (Lunch at your own expense)"
      },
      {
        time: "14:00",
        title: "Haeunde Blueline Park - Cheongsapo Station",
        description: "Free time, Sightseeing (40 minutes) - Free time in Cheongsapo! Ride the Sky Capsule or Beach Train (optional, on-site purchase, guide will assist you). Be aware: during peak season, tickets may sell out quickly. Even without riding the capsule or train, you can still fully enjoy the beautiful scenery, listen to the guide's explanations, and have a wonderful travel experience."
      },
      {
        time: "15:00",
        title: "United Nations Memorial Cemetery",
        description: "Visit, Sightseeing (1 hour) - A moving and respectful visit to honor those who gave their lives during the Korean War."
      },
      {
        time: "16:30",
        title: "Gamcheon Culture Village",
        description: "Visit, Sightseeing (1.5 hours) - End the day in Busan's most colorful neighborhood, famous for its murals, art, and winding alleys."
      },
      {
        time: "17:50",
        title: "Jagalchi Market",
        description: "Hop-on Hop-off stop (5 minutes)"
      },
      {
        time: "17:50-19:00",
        title: "Drop-off Locations",
        description: "3 drop-off locations: Busan Station, Seomyeon-Yeog, Haeundae Station Exit 5. Special drop-off option at Nampo-dong & Jagalchi Market."
      }
    ],
    
    faqs: [
      {
        question: "What is included in the tour?",
        answer: "All entrance fees (except Sky Capsule which is optional), professional English/Chinese-speaking guide, comfortable transportation, toll fees, parking fees, and fuel fees are all included."
      },
      {
        question: "Is lunch included?",
        answer: "No, lunch is not included. However, we will stop at a local restaurant where you can enjoy a delicious meal at your own expense. Vegetarian, vegan, and special dietary menus are available—please inform us in advance."
      },
      {
        question: "What about the Sky Capsule?",
        answer: "The Sky Capsule and Beach Train tickets are optional and can be purchased on-site. Our guide will assist you with purchasing tickets. Please note that during peak season, tickets may sell out quickly. Even without riding, you can still fully enjoy the beautiful scenery."
      },
      {
        question: "Can the itinerary change?",
        answer: "Yes, the time spent at each attraction may change, or locations may be substituted due to local weather and traffic conditions. We will do our best to show you all the planned attractions."
      },
      {
        question: "What is the cancellation policy?",
        answer: "Free cancellation: Cancel up to 24 hours in advance for a full refund. For example, if your tour is on January 1 at 08:30, cancel before December 31 at 08:30 for a full refund."
      },
      {
        question: "When will I be contacted?",
        answer: "Please leave accurate contact information so we can reach you for a smooth tour. We will contact you via WhatsApp before the tour date."
      },
      {
        question: "What are the pickup and drop-off locations?",
        answer: "Pickup locations: Busan Station (Exit 4) at 08:30, Seomyeon Station (Exit 4) at 08:50, Haeundae Station (Exit 5) at 09:30. Drop-off locations: Nampo-dong & Jagalchi Market at 17:50, Busan Station at 18:00, Seomyeon Station at 18:20, Haeundae Station at 19:00."
      },
      {
        question: "Why choose this tour?",
        answer: "One simple choice - no multiple routes, no confusion. Just one perfect itinerary. All-inclusive - entrance fees, clean transport, and expert guiding are all covered. Freedom & comfort - optional activities like the Sky Capsule give flexibility without pressure. Local flavor - end your day with food, markets, and neighborhoods only locals know best."
      }
    ],
    
    rating: 4.9,
    review_count: 990,
    pickup_points_count: 3,
    dropoff_points_count: 3,
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
    console.log('   가격: ₩' + (result.data?.price || priceInWon).toLocaleString());
    console.log('   도시:', result.data?.city);
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




