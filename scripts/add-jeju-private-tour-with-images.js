// ============================================
// Add Jeju: Private Car Charter Tour (with Image Upload)
// ============================================
// 이 스크립트는 이미지를 Supabase에 업로드하고 투어를 생성합니다.
// 브라우저 콘솔에서 실행하세요 (admin 로그인 필요)
// 
// 사용 방법:
// 1. /admin에서 로그인
// 2. 브라우저 콘솔에서 이 스크립트 실행
// 3. startTourCreation() 함수 실행
// 4. 이미지 파일들을 선택하여 업로드
// 5. 자동으로 투어가 생성됩니다

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
  
  // 이미지 업로드 함수
  const uploadImage = async (file, folder = 'tours', type = 'product') => {
    if (!file) return null;
    
    console.log(`📤 업로드 중: ${file.name}...`);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    formData.append('folder', folder);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ 업로드 실패:', result.error || result.message);
        return null;
      }
      
      const url = result.url || result.data?.url;
      console.log(`✅ 업로드 성공: ${url}`);
      return url;
    } catch (error) {
      console.error('❌ 에러 발생:', error);
      return null;
    }
  };
  
  // 여러 이미지 업로드 함수
  const uploadImages = async (files, folder = 'tours/gallery', type = 'gallery') => {
    if (!files || files.length === 0) return [];
    
    console.log(`📤 ${files.length}개 이미지 업로드 중...`);
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    formData.append('type', type);
    formData.append('folder', folder);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: formData
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('❌ 업로드 실패:', result.error || result.message);
        return [];
      }
      
      // API 응답 형식에 따라 URL 추출
      const urls = result.files?.map(f => f.url) || result.urls || [];
      console.log(`✅ ${urls.length}개 이미지 업로드 성공!`);
      return urls;
    } catch (error) {
      console.error('❌ 에러 발생:', error);
      return [];
    }
  };
  
  // 파일 선택 헬퍼
  const selectFiles = (multiple = false) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = multiple;
      input.onchange = (e) => {
        resolve(Array.from(e.target.files || []));
      };
      input.click();
    });
  };
  
  // 메인 함수: 이미지 업로드 및 투어 생성
  window.startTourCreation = async () => {
    console.log('🚀 제주 프라이빗 투어 생성 시작...');
    console.log('');
    
    // 1. 썸네일 이미지 업로드 (5번째 사진)
    console.log('📸 1단계: 썸네일 이미지 업로드');
    console.log('   → 검은색 미니밴이 해안 도로를 달리는 사진을 선택하세요');
    const thumbnailFiles = await selectFiles(false);
    if (thumbnailFiles.length === 0) {
      console.error('❌ 썸네일 이미지를 선택하지 않았습니다.');
      return;
    }
    
    const thumbnailUrl = await uploadImage(thumbnailFiles[0], 'tours', 'product');
    if (!thumbnailUrl) {
      console.error('❌ 썸네일 업로드 실패');
      return;
    }
    
    console.log('');
    
    // 2. 갤러리 이미지 업로드 (나머지 6장)
    console.log('📸 2단계: 갤러리 이미지 업로드');
    console.log('   → 나머지 6장의 이미지를 모두 선택하세요');
    console.log('   → 순서: 1.돌하르방, 2.해녀행진, 3.말타기, 4.핑크뮬리, 5.다리일출, 6.성산일출봉');
    const galleryFiles = await selectFiles(true);
    if (galleryFiles.length === 0) {
      console.error('❌ 갤러리 이미지를 선택하지 않았습니다.');
      return;
    }
    
    if (galleryFiles.length !== 6) {
      console.warn(`⚠️  갤러리 이미지는 6장이어야 하는데 ${galleryFiles.length}장 선택되었습니다.`);
    }
    
    const galleryUrls = await uploadImages(galleryFiles, 'tours/gallery', 'gallery');
    if (galleryUrls.length === 0) {
      console.error('❌ 갤러리 이미지 업로드 실패');
      return;
    }
    
    console.log('');
    console.log('✅ 모든 이미지 업로드 완료!');
    console.log('');
    
    // 3. 투어 데이터 생성
    console.log('📝 3단계: 투어 데이터 생성 중...');
    
    const basePrice = 399000;
    const originalPrice = 471500;
    const timestamp = Date.now();
    const newSlug = `jeju-private-car-charter-tour-${timestamp}`;
    
    const tourData = {
      // ===== 필수 필드 =====
      title: "Jeju Island: Private Car Charter Tour",
      slug: newSlug,
      city: "Jeju",
      price: basePrice,
      price_type: "group",
      image_url: thumbnailUrl, // 업로드된 썸네일 경로
      
      // ===== 선택 필드 =====
      tag: "Private Tour · Day tour",
      subtitle: "Customized Experience",
      description: "Hire a car and licensed guide for a day and make seeing the top sights in Jeju a breeze for this largest island in Korea. Travel in an air-conditioned car with plenty of space. Relax and let your driver take you to the sights that interest you most. Skip the hassle of public transportation. Begin your customized tour of Jeju at the time that best fits you and benefit from an itinerary that can be altered and adjusted according to your interests. With a wealth of attractions on offer at all the major sightseeing spots, your guided tour will give you a personalized experience in paradise.",
      original_price: originalPrice,
      duration: "9 hours",
      lunch_included: false,
      ticket_included: false,
      
      // 업로드된 갤러리 이미지 경로들
      gallery_images: galleryUrls,
      
      pickup_info: "Please wait in the hotel lobby 10 minutes before your scheduled pickup time. Pickup within Jeju Downtown Area (within 6km from Jeju Airport, e.g., Nohyeong-dong or Yeon-dong) is included in the base price. Pickup outside of Jeju City (Seogwipo, Aewol, Hanlim, Seongsan, Hangyeong, Jochon, Pyoseon, Namwon, Andeok, Daejeong, etc.) incurs an additional fee. Airport pickup and drop-off services on the tour date are free of charge if requested. Please provide the exact number of passengers and luggage when booking.",
      
      notes: `Important Information - Know before you go:

There will be overtime charge if you use the vehicle over 9 hours, an additional hour fee is 25,000 won per hour, please pay in cash to the driver.

In order to make the most of your time, your private customized itineraries are limited to visit in one area (ex. Eastern tour in one day / Southern tour in one day), otherwise you will waste a lot of time on the road. If you want to visit two different parts of island in a day, extra costs KRW 60,000 will be incurred as round island charge.

Let us know if you need airport sending and pick up services on the tour date and it's free of charge.

Please provide the exact number of passengers and luggages when you make your booking.

Our staff will contact you via WhatsApp the day before the tour date, if you didn't receive our message until 8pm, please contact us.

Leave a WhatsApp number will make your tour easier.

Free cancellation: Cancel up to 24 hours in advance for a full refund.`,
      
      highlights: [
        "Comfortable feeling that you can't be felt in a group tour",
        "With over 10-years experienced professional driver-guides will company you",
        "Provide hotel pick-up and drop off service, put aside all the hassle",
        "Visit Jeju UNESCO sites and hidden gems with ease"
      ],
      
      includes: [
        "Hotel pick up and drop off",
        "Private vehicle (air-conditioned, spacious)",
        "Chinese/English Professional speaking driver-guide",
        "Fuel fees",
        "Toll fees",
        "Parking fees",
        "Tax",
        "Airport pickup and drop-off (on tour date, free)"
      ],
      
      excludes: [
        "Admissions to attractions",
        "Meals and beverages",
        "Tips",
        "Personal travel insurance"
      ],
      
      schedule: [
        {
          time: "09:00",
          title: "Hotel Pickup",
          description: "Please wait in the hotel lobby 10 minutes before your scheduled pickup time. Tour start time can be adjusted upon request."
        },
        {
          time: "09:00-18:00",
          title: "Customized Tour (Choose Your Route)",
          description: "Eastern Route: Udo Island, Seongsan Ilchulbong Peak, Jeju Aquarium Planet, Cape Seokjikoji, Seongeup Folk Village, ECO Land Theme Park, Sangumburi Crater, Manjanggul cave, Hamdeok Beach, Ilchul Land, Bijarim Forest, Nanta show. Western Route: Aewol Seaside Cafe, Hyeopjae Beach, Hallim Park, Green Tea Field. Southern Route: Cheonjiyeon waterfall, Yak-cheon-sa Temple, Seogwipo Maeil Olle Market, Columnar Joint, Jeongbang Waterfall, Camellia hill, Teddy Bear Safari, Sanbangsan Mountain, Marado submarine, Songaksan Mountain, Cafe the Cliff, 4D Alive Museum, Jeju Speed boat, Dolphin Yachat tour."
        },
        {
          time: "13:00",
          title: "Lunch (Optional)",
          description: "Enjoy local Jeju specialties at a local restaurant. Meal costs are separate."
        },
        {
          time: "18:00",
          title: "Hotel Drop-off",
          description: "Safe drop-off at your hotel after the tour ends."
        }
      ],
      
      faqs: [
        {
          question: "What are the advantages of a private tour?",
          answer: "Unlike group tours, you can travel freely with your own schedule and spend enough time at places you want to visit. With a professional driver-guide, you can enjoy Jeju comfortably without worrying about transportation or finding directions."
        },
        {
          question: "Can I change the tour time?",
          answer: "Yes, the tour start time can be adjusted according to your request. Please let us know your preferred time when booking."
        },
        {
          question: "What areas can I visit?",
          answer: "You can visit all areas of Jeju including Eastern, Western, and Southern routes. For efficient time management, we recommend visiting one area per day (choose from Eastern/Western/Southern)."
        },
        {
          question: "What happens if we exceed 9 hours?",
          answer: "An overtime charge of 25,000 won per hour applies if the vehicle is used over 9 hours, payable in cash to the driver."
        },
        {
          question: "Can I visit multiple areas in one day?",
          answer: "Yes, but it takes a lot of time. Visiting multiple areas in one day incurs an extra KRW 60,000 'round island charge'."
        },
        {
          question: "Is airport pickup available?",
          answer: "Yes, airport pickup and drop-off services on the tour date are free of charge. Please let us know when booking."
        },
        {
          question: "What is the cancellation policy?",
          answer: "Cancel up to 24 hours in advance for a full refund. For example, if your tour is on January 1 at 09:00, cancel before December 31 at 09:00 for a full refund."
        },
        {
          question: "When will I be contacted after booking?",
          answer: "Our staff will contact you via WhatsApp the day before the tour date by 8 pm. If you don't receive a message, please contact us. Providing a WhatsApp number is recommended for easier communication."
        },
        {
          question: "Are admission fees and meals included?",
          answer: "Admission fees and meals are not included. You need to pay separately for attraction entrance fees and meal costs."
        },
        {
          question: "Is pickup available from areas outside Jeju City?",
          answer: "Yes. Pickup from areas outside Jeju City (Seogwipo, Aewol, Hanlim, Seongsan, etc.) may incur additional fees. Please let us know your pickup location when booking for accurate pricing."
        }
      ],
      
      pickup_points: [
        {
          name: "Pickup within Jeju Downtown Area",
          address: "Within 6km from Jeju Airport (e.g., Nohyeong-dong or Yeon-dong)",
          lat: 33.4996,
          lng: 126.5312,
          pickup_time: "09:00"
        },
        {
          name: "Pickup outside of Jeju City",
          address: "Seogwipo, Aewol, Hanlim, Seongsan, Hangyeong, Jochon, Pyoseon, Namwon, Andeok, Daejeong, etc.",
          lat: 33.2500,
          lng: 126.5600,
          pickup_time: "09:00"
        }
      ],
      
      badges: ["Top rated", "Free cancellation", "Reserve now & pay later"],
      rating: 4.8,
      review_count: 154,
      pickup_points_count: 2,
      dropoff_points_count: 1,
      is_active: true,
      is_featured: true
    };
    
    // 4. 투어 생성
    console.log('📡 4단계: 투어 생성 중...');
    
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
      console.log('   썸네일:', thumbnailUrl);
      console.log('   갤러리 이미지:', galleryUrls.length, '장');
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
  };
  
  console.log('✅ 스크립트 준비 완료!');
  console.log('');
  console.log('🔧 사용 방법:');
  console.log('   1. startTourCreation() 함수를 실행하세요');
  console.log('   2. 썸네일 이미지(5번째 사진)를 선택하세요');
  console.log('   3. 갤러리 이미지(나머지 6장)를 선택하세요');
  console.log('   4. 자동으로 투어가 생성됩니다!');
  console.log('');
  console.log('💡 예시:');
  console.log('   await startTourCreation();');
  console.log('');
  
  return {
    startTourCreation: window.startTourCreation,
    uploadImage,
    uploadImages
  };
})();


