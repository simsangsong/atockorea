// ============================================
// Add Private Busan Tour - Discover Top Sights with a Local Guide
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
  
  console.log('🚀 부산 프라이빗 투어 추가 시작...');
  console.log('');
  
  // 투어 데이터 생성
  const timestamp = Date.now();
  const newSlug = `private-busan-tour-discover-top-sights-${timestamp}`;
  
  // €307를 원화로 변환 (대략 440,000원, 실제 환율에 맞게 조정 필요)
  const priceInWon = 440000; // €307 ≈ 440,000원 (group price)
  
  const tourData = {
    // ===== 필수 필드 =====
    title: "Private Busan Tour - Discover Top Sights with a Local Guide",
    slug: newSlug,
    city: "Busan",
    price: priceInWon,
    price_type: "group",
    image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80", // 임시 이미지, 실제 이미지로 교체 필요
    
    // ===== 선택 필드 =====
    tag: "Busan · Private Tour",
    subtitle: "Top rated",
    description: `Experience stunning coastal views, bustling markets, and colorful cultural spots. Wander through ancient temples, cross scenic bridges, and dive into the vibrant energy of local villages.

This is a customized Busan adventure, exploring the city's most iconic and breathtaking attractions with a licensed guide. This tour blends culture, history, and natural beauty, ensuring you experience the best of Busan.`,
    
    original_price: null,
    duration: "4-8 hours",
    lunch_included: false,
    ticket_included: false,
    
    gallery_images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop"
    ],
    
    pickup_info: `If you are staying at an accommodation, pickup is from the ground floor of the building. For cruise passengers pickup is at the exit customs gate Busan Port, and for those being picked up at the Busan Train Station, pickup is at exit 5 of the station.

Pickup is offered at hotels, cruise terminals, the Busan Train Station, bus terminals, guest houses, and apartments throughout Busan.`,
    
    notes: `Important Information - Know before you go:

What to bring:
• Comfortable shoes
• Hat
• Camera
• Sunscreen
• Water

Not allowed:
• Pets
• Smoking

Advance online reservation is required if you wish to ride the Blueline Capsule Train included in your itinerary. For convenience, an official website link is provided for affordable tickets: https://www.bluelinepark.com/eng/booking.do

It is recommended to book according to your pickup time. If your pickup is at 09:00, there are two options for the Blueline Capsule Train:
• Option 1: 30 minutes later → Mipo to Cheongsapo (09:30-10:00)
• Option 2: (If Option 1 is sold out) 2 hours later → Cheongsapo to Mipo (11:00-11:30)

Free cancellation: Cancel up to 24 hours in advance for a full refund.

Reserve now & pay later: Keep your travel plans flexible — book your spot and pay nothing today.`,
    
    highlights: [
      "Discover the beauty of Busan on a private guided tour of the city",
      "Visit the iconic Haedong Yonggung Temple and the Gwangan Bridge",
      "Explore the bustling Jagalchi Fish Market and the lively International Market",
      "Walk along the scenic Songdo Yonggung Cloud Bridge and the Gamcheon Culture Village",
      "Enjoy the freedom to craft your own unique adventure with a private guide"
    ],
    
    includes: [
      "Hotel pickup and drop-off",
      "Air-conditioned vehicle",
      "Certified National Tour Guide",
      "Vehicle Fuel Costs",
      "Toll Fee",
      "Parking Fee",
      "Help with taking pictures"
    ],
    
    excludes: [
      "Lunch",
      "Entrance fees",
      "Gratuity"
    ],
    
    schedule: [
      {
        time: "09:00",
        title: "Pickup location: Busan",
        description: "Pickup from your hotel, cruise terminal, Busan Train Station (Exit 5), or other designated location in Busan."
      },
      {
        time: "09:30",
        title: "Haedong Yonggungsa Temple",
        description: "Guided tour (1 hour) - A temple by the sea, dating back to 1376, offering ocean views and a serene atmosphere. Walk down 108 steps to admire coastal scenery and architecture. A prime spot for sunrise."
      },
      {
        time: "10:30",
        title: "Blue Line Capsule",
        description: "Visit (40 minutes) - A 4.8km journey on an old railway line, offering ocean views through panoramic windows. The 30-minute ride passes Cheongsapo Port's fishing boats, rock formations, and hidden beaches. Climate-controlled capsules provide intimate seating for couples or small groups with audio guides."
      },
      {
        time: "11:30",
        title: "Gwangan (Diamond) Bridge",
        description: "Pass by (10 minutes) - A 7.4-kilometer-long suspension bridge, best admired from Gwangalli Beach where it lights up at night, creating a romantic scene."
      },
      {
        time: "12:00",
        title: "Photo stop",
        description: "(20 minutes) Optional - Stop for photos at scenic viewpoints."
      },
      {
        time: "13:00",
        title: "Jagalchi Fish Market",
        description: "Guided tour (1 hour) - Korea's largest seafood market, where visitors can explore a variety of seafood and have it cooked fresh on the spot. A unique cultural experience due to its lively energy and rich history."
      },
      {
        time: "14:00",
        title: "BIFF Square",
        description: "Guided tour (30 minutes) - The heart of the Busan International Film Festival, where movie lovers can see handprints of famous directors and actors embedded in the pavement. Local street food like ssiat hotteok (seed pancakes) and tteokbokki (spicy rice cakes) are available."
      },
      {
        time: "14:30",
        title: "Gukje Market",
        description: "Guided tour (30 minutes) - One of Busan's largest traditional markets, offering a blend of retro and modern items including clothing, electronics, and household goods. The market also features street food stalls where you can try a variety of local snacks."
      },
      {
        time: "15:30",
        title: "Gamcheon Culture Village",
        description: "Guided tour (1 hour) - Known for its vibrant, colorful houses that look like stacked LEGO blocks. Originally a settlement for war refugees, the village has transformed into a cultural hub filled with murals, art installations, and quaint cafes. Explore its winding streets and discover the stories behind this unique and historical neighborhood."
      },
      {
        time: "16:30",
        title: "Songdo Yonggung Cloud Bridge",
        description: "Guided tour (30 minutes) - Walk along the scenic Songdo Yonggung Cloud Bridge, suspended 25 meters above the ocean. This glass-bottom bridge offers stunning views of the coastline, connecting Amnam Park to Dongdo Island. It's a must-visit for nature lovers and photographers alike."
      },
      {
        time: "17:00",
        title: "Arrive back at: Busan",
        description: "Drop-off at your hotel or preferred location in Busan."
      }
    ],
    
    faqs: [
      {
        question: "What is included in the tour?",
        answer: "Hotel pickup and drop-off, air-conditioned vehicle, certified National Tour Guide, vehicle fuel costs, toll fees, parking fees, and help with taking pictures are all included."
      },
      {
        question: "What is not included?",
        answer: "Lunch, entrance fees, and gratuity are not included in the tour price."
      },
      {
        question: "How long is the tour?",
        answer: "The tour duration is 4-8 hours, depending on your preferences and the attractions you choose to visit."
      },
      {
        question: "What is the group size?",
        answer: "This is a private tour for up to 7 people per group. You'll have the guide and vehicle to yourself."
      },
      {
        question: "Is the tour wheelchair accessible?",
        answer: "Yes, the tour is wheelchair accessible. Please let us know in advance if you need wheelchair accessibility."
      },
      {
        question: "What language is the tour conducted in?",
        answer: "The tour is conducted in English by a certified National Tour Guide."
      },
      {
        question: "Do I need to book the Blueline Capsule Train in advance?",
        answer: "Yes, advance online reservation is required if you wish to ride the Blueline Capsule Train. We provide a link to the official website for booking: https://www.bluelinepark.com/eng/booking.do"
      },
      {
        question: "What should I bring?",
        answer: "Comfortable shoes, hat, camera, sunscreen, and water are recommended. Pets and smoking are not allowed."
      },
      {
        question: "What is the cancellation policy?",
        answer: "Free cancellation: Cancel up to 24 hours in advance for a full refund."
      },
      {
        question: "Can I customize the itinerary?",
        answer: "Yes, this is a private tour that allows you to craft your own unique adventure with your guide. You can discuss your preferences with the guide and adjust the itinerary accordingly."
      }
    ],
    
    rating: 5.0,
    review_count: 20,
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
    console.log('   가격: ₩' + (result.data?.price || priceInWon).toLocaleString() + ' (그룹당)');
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




