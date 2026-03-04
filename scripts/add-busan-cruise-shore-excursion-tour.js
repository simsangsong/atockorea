// ============================================
// 부산 크루즈 셔어익스커션 투어 생성
// Busan: City Tour Shore Excursion for Cruise Guests
// ============================================
// 사용법: /admin 로그인 후 F12 → Console → 이 스크립트 전체 복사 → 붙여넣기 → Enter

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

  const slug = 'busan-city-tour-shore-excursion-cruise-guests';
  const origin = window.location.origin || 'http://localhost:3000';

  const tourData = {
    title: 'Busan: City Tour Shore Excursion for Cruise Guests',
    slug,
    city: 'Busan',
    price: 82560,
    original_price: 96000,
    price_type: 'person',
    image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80',
    tag: 'Cruise',
    subtitle: '100% guaranteed on-time return to port · English guide',
    description: `Explore Busan on a tour designed for cruise passengers, with 100% guaranteed on-time return to port. Discover top attractions with a certified local guide and enjoy a flexible, worry-free city tour.

This tour is designed exclusively for cruise layover passengers arriving in Busan. We can arrange pickup and drop-off at any time based on your cruise ship schedule. No matter what time your ship arrives or departs, we will adjust accordingly. We always schedule the tour according to the cruise ship's arrival and departure times. No exceptions! Pickup is always at the cruise ship's arrival time, and drop-off is always before the ship departs. Even if you cannot select an option for the cruise arrival time, we will communicate with you via messenger and adjust the tour schedule to match your cruise ship's timing.

Join a tour designed exclusively for cruise passengers visiting Busan by cruise ship. Meet your guide when the cruise ship docks at Busan Port. The tour schedule is precisely aligned with the cruise itinerary, allowing passengers to explore Busan's history, culture, and local markets. The tour includes entrance fees to attractions and an experienced, certified guide. Since this tour is tailored to the cruise schedule, the duration may vary; time spent at each attraction might be shorter or longer. If a tourist site is located far away and the return time to the cruise becomes tight, that stop may be skipped. The guide will make accurate adjustments on-site as needed.`,
    duration: '9 hours',
    lunch_included: false,
    ticket_included: true,
    pickup_info: `Busan Cruise Port pickup and drop-off. Your guide will wait at Busan Port one hour before the cruise arrives. Once you disembark from the cruise, you will find our guide holding a "Love Korea" sign inside the terminal. If you do not see the guide, please do not walk away—stay and wait inside the terminal and look for the "Love Korea" team. Contact us via WhatsApp for faster response: +82 10 4521 7582. 100% Guaranteed On-Time Return to Port!`,
    notes: `What to bring: Comfortable shoes, Camera, Sunscreen.

Know before you go: Pickup and drop-off are scheduled to match your cruise ship's arrival and departure times. General window: 7:00 AM to 10:00 PM. Early pickup at 6:00 AM is possible with an additional guide fee of 10,000 KRW per person. 100% Guaranteed on-time pickup & drop-off directly at the cruise terminal. Tour times may change depending on cruise arrival and departure. Lunch will be provided at a local restaurant; please inform us of any dietary restrictions in advance. For faster response, contact us via WhatsApp: +82 10 4521 7582. Tourist attractions may be subject to change based on local conditions such as traffic and weather; changes are at the guide's discretion.`,
    highlights: [
      '100% Guaranteed on-time pickup & drop-off directly at the cruise terminal',
      "Explore the city's history, culture, and local markets",
      "Visit the city's top attractions and enjoy the flexibility",
      'Benefit from a tour schedule that is precisely aligned with the cruise itinerary',
      'Enjoy a Busan city tour designed exclusively for cruise passengers'
    ],
    includes: [
      'Busan Cruise Port pickup and drop-off',
      'Entrance fees to attractions',
      'Experienced, certified guide',
      'No shopping',
      '100% Guaranteed On-Time Return to Port'
    ],
    excludes: [
      'Meals (lunch cost) and personal expenses',
      'Personal travel insurance',
      'Admission fee for Busan Tower (payable on-site, optional)',
      'Admission fee for Songdo Sky Cable (payable on-site, optional)'
    ],
    schedule: [
      { time: 'Variable', title: 'Pickup at Cruise Terminal', description: 'Busan International Passenger Terminal Cruise Boarding Point (부산항국제여객터미널 크루즈탑승장). Pickup time matches your cruise ship arrival.' },
      { time: '~1h', title: 'Yonggungsa Temple (용궁사)', description: 'Guided tour, Sightseeing. 1 hour.' },
      { time: '~1h', title: 'United Nations Memorial Cemetery (유엔기념공원)', description: 'Guided tour, Sightseeing. 1 hour.' },
      { time: '~1.5h', title: 'Songdo Beach (송도해수욕장)', description: 'Guided tour, Sightseeing. 1.5 hours.' },
      { time: '~1h', title: 'Local restaurant (점심)', description: 'Lunch. Optional. 1 hour.' },
      { time: '~1.5h', title: 'Gamcheon Culture Village (감천문화마을)', description: 'Guided tour, Sightseeing. 1.5 hours.' },
      { time: '—', title: 'Yongdusan Park (용두산공원)', description: 'Guided tour, Sightseeing.' },
      { time: '—', title: 'Nampo-dong (남포동)', description: 'Guided tour, Sightseeing.' },
      { time: '—', title: 'Jagalchi Market (자갈치시장)', description: 'Guided tour, Sightseeing.' },
      { time: 'Variable', title: 'Drop-off at Cruise Terminal', description: 'Busan International Passenger Terminal Cruise Boarding Point. 100% guaranteed on-time return before ship departure.' }
    ],
    faqs: [
      { question: 'I arrive at 12 PM. Can I be picked up?', answer: 'Absolutely! We adjust the tour schedule to match your cruise ship\'s arrival and departure times.' },
      { question: 'Our ship departs at 3 PM. Will we be back at the port by 2:30 PM?', answer: '100% guaranteed. We always return you to the port in time before your ship departs.' },
      { question: 'Where do I meet the guide?', answer: 'Your guide will wait at Busan Port one hour before the cruise arrives, holding a "Love Korea" sign inside the terminal.' },
      { question: 'Is lunch included?', answer: 'Lunch will be provided at a local restaurant; the cost is not included. Please inform us of any dietary restrictions in advance.' },
      { question: 'What if I cannot find the guide?', answer: 'Stay inside the terminal and look for the "Love Korea" team. Contact us via WhatsApp: +82 10 4521 7582.' }
    ],
    pickup_points: [
      { name: 'Busan International Passenger Terminal (Cruise Boarding Point)', address: '부산항국제여객터미널 크루즈탑승장, Busan Port, South Korea', lat: 35.1028, lng: 129.0393, pickup_time: 'According to cruise arrival' }
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
    console.log('✅ 부산 크루즈 셔어익스커션 투어 생성 완료:', data.data?.title);
    console.log('   ID:', data.data?.id);
    console.log('   Slug:', data.data?.slug);
  } catch (err) {
    console.error('❌ 요청 오류:', err.message);
  }
})();
