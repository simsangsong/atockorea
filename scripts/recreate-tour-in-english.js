// ============================================
// 투어 삭제 후 영어 내용으로 동일 slug로 재생성 (API Console)
// ============================================
// 사용 대상: slug "jeju-private-car-charter-tour" (제주도 프라이빗 자동차 투어)
// - 기존 투어를 삭제한 뒤, description 등 상세 내용은 그대로 두고
//   제목/설명 등을 영어로 넣어 같은 slug로 다시 생성합니다.
//
// 사용 방법:
// 1. /admin 에서 로그인
// 2. F12 → Console 에 이 스크립트 전체 붙여넣기 후 실행

const TARGET_SLUG = 'jeju-private-car-charter-tour';

// 재생성 시 사용할 영어 기본 정보 (기존 폼 값 기준)
const ENGLISH_CONTENT = {
  title: 'Jeju Island Private Car Charter Tour',
  tag: 'Jeju · Private Tour',
  subtitle: 'A premium, fully customized Jeju experience with a top-tier professional driver-guide.',
  description: `This is a private tour that allows you to explore Jeju Island's major attractions in comfort. Travel in a spacious, air-conditioned vehicle with a professional driver-guide, bypassing public transportation and enjoying easy access to Jeju's top sights.

With a fully customized itinerary, the schedule can be adjusted to match your personal interests and time constraints. Accompanied by an experienced guide, you can visit a variety of attractions and enjoy a personalized experience surrounded by Jeju's natural beauty.`,
  duration: '9 hours',
};

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
    console.error('❌ 인증 토큰 없음. /admin 에서 로그인 후 다시 실행하세요.');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  console.log('📋 투어 목록 조회 중...');
  const listRes = await fetch('/api/admin/tours', { headers: { 'Authorization': `Bearer ${token}` } });
  if (!listRes.ok) {
    console.error('❌ 목록 조회 실패:', listRes.status);
    return;
  }
  const listData = await listRes.json();
  const tours = listData.data || [];
  const tour = tours.find(t => (t.slug || '').toLowerCase() === TARGET_SLUG.toLowerCase());
  if (!tour) {
    console.error('❌ slug "' + TARGET_SLUG + '" 에 해당하는 투어가 없습니다.');
    console.log('등록된 slug:', tours.map(t => t.slug));
    return;
  }

  const tourId = tour.id;
  console.log('📖 투어 상세 조회:', tour.title, '(id:', tourId, ')');

  const getRes = await fetch(`/api/admin/tours/${tourId}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!getRes.ok) {
    console.error('❌ 상세 조회 실패:', getRes.status);
    return;
  }
  const { data: fullTour } = await getRes.json();
  if (!fullTour) {
    console.error('❌ 투어 데이터 없음');
    return;
  }

  const pickupPoints = fullTour.pickup_points || [];

  console.log('🗑️ 투어 삭제 중...');
  const delRes = await fetch(`/api/admin/tours/${tourId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!delRes.ok) {
    const err = await delRes.json();
    console.error('❌ 삭제 실패:', err.error || err.details || delRes.statusText);
    return;
  }
  console.log('✅ 삭제 완료');

  const payload = {
    title: ENGLISH_CONTENT.title,
    slug: TARGET_SLUG,
    city: fullTour.city || 'Jeju',
    tag: ENGLISH_CONTENT.tag || fullTour.tag,
    subtitle: ENGLISH_CONTENT.subtitle || fullTour.subtitle,
    description: ENGLISH_CONTENT.description || fullTour.description,
    price: parseFloat(fullTour.price) || 0,
    original_price: fullTour.original_price != null ? parseFloat(fullTour.original_price) : null,
    price_type: fullTour.price_type || 'person',
    image_url: fullTour.image_url || '',
    gallery_images: Array.isArray(fullTour.gallery_images) ? fullTour.gallery_images : [],
    duration: ENGLISH_CONTENT.duration || fullTour.duration,
    lunch_included: !!fullTour.lunch_included,
    ticket_included: !!fullTour.ticket_included,
    pickup_info: fullTour.pickup_info || null,
    notes: fullTour.notes || null,
    highlights: Array.isArray(fullTour.highlights) ? fullTour.highlights : [],
    includes: Array.isArray(fullTour.includes) ? fullTour.includes : [],
    excludes: Array.isArray(fullTour.excludes) ? fullTour.excludes : [],
    schedule: Array.isArray(fullTour.schedule) ? fullTour.schedule : [],
    faqs: Array.isArray(fullTour.faqs) ? fullTour.faqs : [],
    rating: fullTour.rating != null ? parseFloat(fullTour.rating) : 0,
    review_count: fullTour.review_count != null ? parseInt(fullTour.review_count, 10) : 0,
    pickup_points_count: fullTour.pickup_points_count != null ? parseInt(fullTour.pickup_points_count, 10) : 0,
    dropoff_points_count: fullTour.dropoff_points_count != null ? parseInt(fullTour.dropoff_points_count, 10) : 0,
    is_active: fullTour.is_active !== false,
    is_featured: !!fullTour.is_featured,
  };

  console.log('📝 동일 slug로 영어 내용으로 재생성 중...');
  const createRes = await fetch('/api/admin/tours', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!createRes.ok) {
    const err = await createRes.json();
    console.error('❌ 생성 실패:', err.error || err.message || err.details || createRes.statusText);
    return;
  }
  const createData = await createRes.json();
  const newTour = createData.data || createData;
  const newId = newTour.id;
  console.log('✅ 재생성 완료 (id:', newId, ')');

  if (pickupPoints.length > 0) {
    console.log('📍 픽업 장소 복원 중...');
    const ppPayload = {
      pickup_points: pickupPoints.map(pp => ({
        name: pp.name,
        address: pp.address || '',
        lat: pp.lat ?? null,
        lng: pp.lng ?? null,
        pickup_time: pp.pickup_time || null,
      })),
    };
    const patchRes = await fetch(`/api/admin/tours?id=${encodeURIComponent(newId)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(ppPayload),
    });
    if (patchRes.ok) {
      console.log('✅ 픽업 장소 복원 완료');
    } else {
      console.warn('⚠️ 픽업 장소 복원 실패 (관리자에서 수동 등록 가능)');
    }
  }

  console.log('');
  console.log('🏁 완료. 영어 페이지에서 확인하세요:', window.location.origin + '/tour/' + newId);
})();
