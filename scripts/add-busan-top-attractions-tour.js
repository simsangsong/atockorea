// ============================================
// 부산 투어 생성: Busan Top Attractions One-Day Guided Tour
// ============================================
// 사용법: /admin 로그인 후 F12 → Console → 이 스크립트 전체 복사 → 붙여넣기 → Enter
// (allow pasting 필요 시 먼저 입력 후 Enter)

(async () => {
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

  const slug = 'busan-top-attractions-authentic-one-day-guided-tour';
  const origin = window.location.origin || 'http://localhost:3000';

  const tourData = {
    title: 'Busan: Top Attractions Authentic One-Day Guided Tour',
    slug,
    city: 'Busan',
    price: 60750,
    original_price: 67500,
    price_type: 'person',
    image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
    tag: 'Top rated',
    subtitle: 'Loved by English speakers · 97% perfect score',
    description: `If you only have one day in Busan, this is the tour you've been waiting for. No complicated choices, no confusing options—unlike other tours, we offer just one carefully designed itinerary. It's simple, easy, and guaranteed to show you the very best of Busan.

Explore the key attractions of Busan City with a certified English-speaking guide: Gamcheon Culture Village, UN Memorial Cemetery, Haedong Yonggungsa Temple, Cheongsapo, Blue Line Park, and Jagalchi Market. Skip the ticket line and enjoy highly-rated transport. Free cancellation up to 24 hours in advance.`,
    duration: '9.5 hours',
    lunch_included: false,
    ticket_included: false,
    pickup_info: 'Pickup included at 3 locations. (08:30) Busan Subway Station Exit 4 (Not KTX gate). (08:50) Seomyeon Subway Station Exit 4. (09:30) Haeundae Station Exit 5. Drop-off at Seomyeon-Yeog, Busan Station, or Haeundae Station Exit 5.',
    notes: `What to bring: Weather-appropriate clothing.

Know before you go: Please leave accurate contact information so we can reach you for a smooth tour (we will contact you via WhatsApp). The time spent at each attraction may change, or locations may be substituted due to local weather and traffic conditions.`,
    highlights: [
      "Explore Busan's must-see spots in one simple, all-inclusive day tour",
      "Certified professional guide who speaks English",
      "End your tour with a special drop-off at Nampo-dong & Jagalchi Market",
      "Visit Haedong Yonggungsa, Gamcheon Village, and hidden coastal gems",
      "Exceptional value without compromise"
    ],
    includes: [
      "Admission to attractions",
      "English-speaking professional guide",
      "Toll fees, Parking fees, Fuel fees",
      "Crossing Gwangan Bridge Fee"
    ],
    excludes: [
      "Lunch break is included, but lunch is at your own expense",
      "Other personal expenses, Personal Insurance",
      "Sky Capsule & Beach Train Ticket (on-site)"
    ],
    schedule: [
      { time: '08:30', title: 'Pickup', description: '3 pickup location options: Haeundae Station Exit 5, Busan Station, Seomyeon-Yeog.' },
      { time: '09:00', title: 'Yonggungsa Temple (Haedong Yonggungsa)', description: 'Visit, Sightseeing. 80 minutes.' },
      { time: '10:30', title: 'Cheongsapo Daritdol Observatory', description: 'Visit, Sightseeing. 30 minutes.' },
      { time: '11:00', title: 'Local restaurant', description: 'Lunch. Optional. 1 hour.' },
      { time: '12:00', title: 'Haeundae Blueline Park - Cheongsapo Station', description: 'Free time, Sightseeing. 40 minutes.' },
      { time: '12:45', title: 'Gwangan Bridge', description: 'Pass by.' },
      { time: '13:00', title: 'United Nations Memorial Cemetery', description: 'Visit, Sightseeing. 1 hour.' },
      { time: '14:15', title: 'Gamcheon Culture Village', description: 'Visit, Sightseeing. 1.5 hours.' },
      { time: '16:00', title: 'Jagalchi Market', description: 'Hop-on Hop-off stop. 5 minutes.' },
      { time: '17:30', title: 'Drop-off', description: '3 drop-off locations: Seomyeon-Yeog, Busan Station, Haeundae Station Exit 5.' }
    ],
    faqs: [
      { question: 'Is lunch included?', answer: 'Lunch break is included in the itinerary, but lunch is at your own expense.' },
      { question: 'What is the cancellation policy?', answer: 'Cancel up to 24 hours in advance for a full refund.' },
      { question: 'How will you contact me?', answer: 'Please leave accurate contact information. We will contact you via WhatsApp for a smooth tour.' },
      { question: 'Can the itinerary change?', answer: 'The time spent at each attraction may change, or locations may be substituted due to local weather and traffic conditions.' }
    ],
    pickup_points: [
      { name: 'Busan Subway Station Exit 4 (Not KTX gate)', address: 'Busan Station, Jungang-daero, Jung-gu, Busan', lat: 35.1142, lng: 129.0416, pickup_time: '08:30' },
      { name: 'Seomyeon Subway Station Exit 4', address: 'Seomyeon Station, Seomyeon-ro, Busanjin-gu, Busan', lat: 35.1579, lng: 129.0594, pickup_time: '08:50' },
      { name: 'Haeundae Station Exit 5', address: 'Haeundae Station, Haeundaehaebyeon-ro, Haeundae-gu, Busan', lat: 35.1631, lng: 129.1604, pickup_time: '09:30' }
    ],
    gallery_images: [
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
      'https://images.unsplash.com/photo-1582657118090-af375e849dd7?w=1200&q=80',
      'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=1200&q=80'
    ],
    is_active: true,
    is_featured: false
  };

  try {
    const res = await fetch(`${origin}/api/admin/tours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(tourData),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('❌ 생성 실패:', data.error || data.message || res.statusText);
      return;
    }
    console.log('✅ 부산 투어 생성 완료:', data.data?.title);
    console.log('   ID:', data.data?.id);
    console.log('   Slug:', data.data?.slug);
  } catch (err) {
    console.error('❌ 요청 오류:', err.message);
  }
})();
