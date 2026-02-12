// 간단한 한 줄 버전 - 브라우저 콘솔에서 바로 실행
// 사용법: 이 파일의 내용을 복사해서 브라우저 콘솔에 붙여넣기

(async () => {
  const tourData = {
    title: "Jeju Island: Full Day Tour for Cruise Ship Passengers",
    slug: "jeju-island-full-day-tour-cruise-passengers",
    city: "Jeju",
    price: 88000,
    price_type: "person",
    image_url: "/images/tours/jeju-cruise-tour-coast.png",
    tag: "Cruise",
    subtitle: "Top rated",
    description: "Exclusive Jeju tour for cruise guests. Pickup & drop-off strictly on time at the cruise terminal. Two itineraries are available for Jeju's two ports, with full details in the description. Welcome to all cruise passengers visiting Jeju Island! This tour is specifically designed for travelers arriving in Jeju by cruise ship for a layover (port stop, stopover). Although the tour time is set at 8:00 AM on the product page, booking is flexible regardless of arrival time. Pickup is arranged based on the cruise ship's schedule to ensure return to the port well before departure.",
    original_price: 88000,
    gallery_images: ["/images/tours/jeju-cruise-tour-coast.png", "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=800&h=600&fit=crop", "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&h=600&fit=crop"],
    duration: "8 hours",
    lunch_included: false,
    ticket_included: true,
    pickup_info: "We will be waiting for you according to the cruise ship's schedule (regardless of the arrival time). Please make sure to select the correct port where your cruise ship will dock. Our guide will be waiting for you in front of the gate where you disembark from the cruise ship, holding a sign that says \"LOVE KOREA.\" There are two ports in Jeju Island: Jeju Port and Gangjeong Seogwipo Port. Pickup and drop-off times are scheduled to match the cruise ship's arrival and departure times (06:00~22:00). Pick-up time at 08:00 am is arbitrarily set. You will be picked up when your cruise arrives at the port (can be changed at any time). Please let us know the name of your cruise ship and your arrival time. Also, make sure to provide a WhatsApp number where we can reach you.",
    notes: "Tour time may change depending on cruise arrival and departure times. Tour schedule may be reduced or changed on site (due to limited time). Please let me know the cruise arrival time. For Private Car option: You can customize the day and destinations. Entrance fees are not included in the private car option. Two itineraries are available depending on Jeju's cruise port: For departures from \"Jeju Port\": Seongsan Ilchulbong, Seopjikoji, Seongeup Folk Village, and Dongmun Market. For departures from \"Seogwipo Gangjeong Port\": Hallasan Mountain, Cheonjiyeon Waterfall, Jusangjeolli Cliffs, and Olle Market. The tour duration and number of attractions can be adjusted based on the cruise's stay in Jeju.",
    highlights: ["Tailored tours for cruise guests with on-time pick-up & drop-off guaranteed", "Enjoy a seamless tour aligned with cruise schedules from arrival to departure", "Discover Jeju's UNESCO sites, vibrant markets, and hidden local gems in comfort", "Certified guides and spacious vehicles ensure a safe and memorable journey", "Two itineraries available depending on Jeju's cruise port, flexible and easy"],
    includes: ["Professional guide", "Cruise port pickup and drop-off", "Comfortable vehicle", "Admission fees (for group tours only)"],
    excludes: ["Lunch costs", "Personal expenses", "Tips", "Personal travel insurance", "Admission fees (for Private car option)"],
    schedule: [{time: "Variable", title: "Pickup - Cruise Terminal", description: "Pickup at cruise terminal according to cruise ship schedule. Two ports available: Jeju Port or Seogwipo Gangjeong Cruise Terminal. Our guide will be waiting in front of the gate where you disembark, holding a \"LOVE KOREA\" sign. Pickup time: 06:00~22:00 (matches cruise arrival time)."}, {time: "Variable", title: "Itinerary A: For Jeju Port Departures", description: "Seongsan Ilchulbong (Sightseeing, 2 hours) - UNESCO World Natural Heritage site, iconic volcanic tuff cone. Seopjikoji (Guided tour, Sightseeing, Walk, 1.5 hours) - Beautiful coastal area with scenic views. Seongeup Folk Village (Guided tour, Walk, 1 hour) - Well-preserved traditional village. Dongmun Traditional Market (Free time, 1 hour) - Vibrant local market."}, {time: "Variable", title: "Itinerary B: For Seogwipo Gangjeong Port Departures", description: "Hallasan National Park (Guided tour, Sightseeing, Walk, 1.5 hours) - South Korea's highest mountain, UNESCO World Heritage Site. Cheonjiyeon Waterfall (Sightseeing, 1.5 hours) - \"The Pond of the Gods,\" three graceful tiers. Jusangjeollidae (Sightseeing, 1.5 hours) - Dramatic hexagonal lava cliffs, Natural Monument No. 443. Seogwipo Olle Market (Sightseeing, 1.5 hours) - Local market with fresh produce and local specialties."}, {time: "Variable", title: "Lunch", description: "Lunch at local restaurant (Optional, at your own expense). Please inform us in advance about any dietary restrictions."}, {time: "Variable", title: "Drop-off - Cruise Terminal", description: "Return to cruise terminal (Jeju Port or Seogwipo Gangjeong Cruise Terminal). Drop-off time is scheduled to match cruise ship departure time, ensuring return well before departure."}],
    faqs: [{question: "Which port will my cruise dock at?", answer: "There are two ports in Jeju Island: Jeju Port and Gangjeong Seogwipo Port. Please make sure to select the correct port where your cruise ship will dock when booking."}, {question: "What time will I be picked up?", answer: "Pickup is arranged based on your cruise ship's schedule. Although the tour time is set at 8:00 AM on the product page, you will be picked up when your cruise arrives at the port (can be changed at any time). Pickup times are scheduled between 06:00~22:00 to match cruise arrival times."}, {question: "Will we return in time for departure?", answer: "Yes, pickup and drop-off times are scheduled to match the cruise ship's arrival and departure times. We guarantee return to the port well before departure."}, {question: "Are admission fees included?", answer: "Admission fees are included for group tours only. For Private Car option, admission fees are not included."}, {question: "Is lunch included?", answer: "No, lunch costs are not included. Lunch is available at local restaurants at your own expense. Please inform us in advance about any dietary restrictions."}, {question: "How do I contact you?", answer: "Please let us know the name of your cruise ship and your arrival time. Also, make sure to provide a WhatsApp number where we can reach you. You can get a faster response using WhatsApp."}, {question: "Can the itinerary change?", answer: "Yes, tour time may change depending on cruise arrival and departure times. Tour schedule may be reduced or changed on site due to limited time. The tour duration and number of attractions can be adjusted based on the cruise's stay in Jeju."}, {question: "What is the difference between group tour and private car?", answer: "For group tours, admission fees are included. For Private Car option, you can customize the day and destinations, but entrance fees are not included."}],
    pickup_points: [{name: "Seogwipo Gangjeong Cruise Terminal", address: "Seogwipo Gangjeong Cruise Terminal, Gangjeong-dong, Seogwipo-si, Jeju-do", lat: 33.2375, lng: 126.5778, pickup_time: null}, {name: "Port of Jeju", address: "Port of Jeju, Jeju-si, Jeju-do", lat: 33.5148, lng: 126.5270, pickup_time: null}],
    rating: 4.8,
    review_count: 138,
    pickup_points_count: 2,
    dropoff_points_count: 2,
    is_active: true,
    is_featured: true
  };
  
  try {
    // Debug: Show all cookies
    console.log('🔍 모든 쿠키:', document.cookie);
    
    // Get session token from cookies (Supabase stores session in cookies)
    let accessToken = null;
    
    // Supabase cookie pattern: sb-<project-ref>-auth-token
    const projectRef = 'cghyvbwmijgpahnoduyv'; // Your Supabase project ref
    const cookieName = `sb-${projectRef}-auth-token`;
    
    console.log('🔍 찾는 쿠키 이름:', cookieName);
    
    // Get all cookies
    const allCookies = document.cookie.split(';').map(c => c.trim());
    console.log('🔍 쿠키 개수:', allCookies.length);
    
    // Try to find Supabase auth cookie
    // Supabase may split large cookies into multiple parts (cookieName.0, cookieName.1, etc.)
    let combinedCookieValue = '';
    const matchingCookies = [];
    
    for (const cookie of allCookies) {
      const [name, value] = cookie.split('=');
      const decodedName = decodeURIComponent(name);
      const decodedValue = value ? decodeURIComponent(value) : '';
      
      // Check for exact match or starts with pattern (for split cookies)
      if (decodedName === cookieName || decodedName.startsWith(cookieName + '.')) {
        console.log('✅ Supabase 쿠키 발견:', decodedName, `(길이: ${decodedValue.length})`);
        console.log('🔍 쿠키 값 (처음 200자):', decodedValue.substring(0, 200));
        matchingCookies.push(decodedValue);
      }
    }
    
    // Combine split cookies if needed
    if (matchingCookies.length > 0) {
      combinedCookieValue = matchingCookies.join('');
      console.log('🔍 결합된 쿠키 값 길이:', combinedCookieValue.length);
      console.log('🔍 결합된 쿠키 값 (처음 500자):', combinedCookieValue.substring(0, 500));
      
      try {
        // Try parsing the combined value
        const parsed = JSON.parse(combinedCookieValue);
        console.log('✅ JSON 파싱 성공! 키 목록:', Object.keys(parsed));
        accessToken = parsed?.access_token || parsed?.accessToken || parsed?.session?.access_token;
        if (accessToken) {
          console.log('✅ access_token 찾음! (결합된 쿠키에서)');
        } else {
          console.warn('⚠️ access_token을 찾을 수 없음. parsed 구조:', Object.keys(parsed));
        }
      } catch (e) {
        console.warn('⚠️ 결합된 쿠키 파싱 실패:', e.message);
        console.warn('⚠️ 쿠키 값이 JSON이 아닐 수 있습니다.');
        // Try each cookie individually
        for (let i = 0; i < matchingCookies.length; i++) {
          const cookieValue = matchingCookies[i];
          console.log(`🔍 개별 쿠키 ${i} 파싱 시도 (길이: ${cookieValue.length})`);
          try {
            const parsed = JSON.parse(cookieValue);
            console.log(`✅ 개별 쿠키 ${i} JSON 파싱 성공!`);
            accessToken = parsed?.access_token || parsed?.accessToken || parsed?.session?.access_token;
            if (accessToken) {
              console.log('✅ access_token 찾음! (개별 쿠키에서)');
              break;
            }
          } catch (e2) {
            console.warn(`⚠️ 개별 쿠키 ${i} 파싱 실패:`, e2.message);
          }
        }
      }
    }
    
    // Fallback: check any cookie with 'auth' in name
    if (!accessToken) {
      for (const cookie of allCookies) {
        const [name, value] = cookie.split('=');
        const decodedName = decodeURIComponent(name);
        const decodedValue = value ? decodeURIComponent(value) : '';
        
        if (decodedName.includes('auth') && decodedValue.length > 50) {
          console.log('🔍 auth 관련 쿠키 확인:', decodedName);
          try {
            const parsed = JSON.parse(decodedValue);
            accessToken = parsed?.access_token || parsed?.accessToken;
            if (accessToken) {
              console.log('✅ access_token 찾음 (fallback)!');
              break;
            }
          } catch (e) {
            // Not JSON, skip
          }
        }
      }
    }
    
    // If no token found, server will try to read from cookies
    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      console.log('✅ Authorization 헤더에 토큰 추가');
    } else {
      console.log('⚠️ 브라우저에서 토큰을 찾지 못했습니다.');
      console.log('⚠️ 서버가 쿠키에서 직접 읽으려고 시도합니다...');
    }
    
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: headers,
      credentials: 'include', // Important: sends all cookies
      body: JSON.stringify(tourData)
    });
    const result = await response.json();
    if (result.data) {
      console.log('✅ 투어 생성 성공!', result.data);
      console.log(`🌐 투어 확인: /tour/${result.data.slug}`);
      alert('✅ 투어 생성 성공!\n\n투어 ID: ' + result.data.id + '\n제목: ' + result.data.title);
    } else {
      console.error('❌ 투어 생성 실패:', result.error);
      alert('❌ 투어 생성 실패: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    alert('❌ 에러 발생: ' + error.message);
  }
})();











