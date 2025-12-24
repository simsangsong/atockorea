/**
 * Create Jeju Private Car Charter Tour
 * Based on the product detail page information
 * 
 * 사용 방법:
 * 1. /admin에서 로그인
 * 2. 브라우저 콘솔에서 이 스크립트 실행
 * 3. createTourWithImages() 함수 실행
 * 4. 이미지 파일들을 순서대로 선택 (썸네일, 갤러리 이미지들)
 */

// 이미지 업로드 함수
const uploadImage = async (file, folder = 'tours', type = 'product') => {
  if (!file) return null;
  
  console.log(`📤 업로드 중: ${file.name}...`);
  
  // Get token from localStorage
  let token = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('auth')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        token = data?.access_token || data?.accessToken || data?.session?.access_token || data?.currentSession?.access_token;
        if (token) break;
      } catch (e) {}
    }
  }
  
  if (!token) {
    throw new Error('No access token found. Please login first.');
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  formData.append('folder', folder);
  
  try {
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const result = await response.json();
    console.log(`✅ 업로드 완료: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error(`❌ 업로드 실패: ${error.message}`);
    throw error;
  }
};

// 여러 이미지 업로드
const uploadMultipleImages = async (files, folder = 'tours/gallery', type = 'gallery') => {
  if (!files || files.length === 0) return [];
  
  console.log(`📤 ${files.length}개 이미지 업로드 중...`);
  
  let token = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('auth')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        token = data?.access_token || data?.accessToken || data?.session?.access_token || data?.currentSession?.access_token;
        if (token) break;
      } catch (e) {}
    }
  }
  
  if (!token) {
    throw new Error('No access token found. Please login first.');
  }
  
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  formData.append('type', type);
  formData.append('folder', folder);
  
  try {
    const response = await fetch('/api/admin/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    
    const result = await response.json();
    const urls = result.files.map(f => f.url);
    console.log(`✅ ${urls.length}개 이미지 업로드 완료`);
    return urls;
  } catch (error) {
    console.error(`❌ 업로드 실패: ${error.message}`);
    throw error;
  }
};

const tourData = {
  title: "Jeju Island: Private Car Charter Tour",
  slug: "jeju-private-car-charter-tour",
  city: "Jeju",
  tag: "Jeju · Private Tour",
  subtitle: "Top rated · Professional driver-guide · Customizable itinerary",
  description: `Explore the most popular attractions in Jeju Island on this private trip. Design your own itinerary with your private driver-guide and see the sites that interest you the most.

Experience the comfort you can't get from group tours. Travel in a spacious, air-conditioned vehicle with a professional driver-guide who has over 10 years of experience. Skip public transportation and easily visit Jeju's UNESCO heritage sites and hidden gems.

Customize your Jeju trip based on your personal interests and time. Enjoy a personalized experience in nature while visiting various famous places with a professional guide.`,

  price: 228000, // €228 ≈ ₩300,000 (approx conversion, adjust as needed)
  original_price: null,
  price_type: "group", // "per group up to 6"
  
  image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
  gallery_images: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
  ],

  duration: "9 hours",
  lunch_included: false,
  ticket_included: false,
  
  pickup_info: `Pickup included. Please wait in the hotel lobby 10 minutes before your scheduled pickup time.

**Pickup Options:**
- Jeju City Pickup Service: If your hotel is located in Jeju City area (within 6km from Jeju Airport, e.g., Nohyeong-dong or Yeon-dong) - ₩ 228,000
- Jeju Outside City Pickup: Seogwipo, Aewol, Hallim, Seongsan, Hangyeong, Jocheon, Pyoseon, Namwon, Andeok, Daejeong, Jungmun areas - ₩ 300,000`,

  notes: `**Important Information:**

- Overtime charges: 25,000 won per hour for vehicle use exceeding 9 hours (cash payment to driver)
- Private tour itineraries are limited to one region per day (e.g., East or South tour) to maximize time. Visiting two different islands incurs an additional 60,000 won round-trip fee.
- Airport transfer and pick-up service on the tour date is free if requested.
- Accurate passenger count and luggage details are required at booking.
- A staff member will contact participants via WhatsApp the day before the tour. If no message is received by 8 PM, please contact us.
- Providing a WhatsApp number is suggested for smoother tour arrangements.`,

  highlights: [
    "Comfortable feeling that you can't get from a group tour",
    "With over 10-years experienced professional driver-guides will accompany you",
    "Provide hotel pick-up and drop-off service, put aside all the hassle",
    "Visit Jeju UNESCO sites and hidden gems with ease",
    "Customizable itinerary based on your interests",
    "Travel in a spacious, air-conditioned vehicle",
    "English, Chinese, Korean speaking guide available",
    "Wheelchair accessible",
    "Private group tour (up to 6 people)",
  ],

  includes: [
    "Hotel pick-up and drop-off service",
    "Private vehicle",
    "English/Chinese/Korean speaking professional driver-guide",
    "Fuel cost",
    "Toll fees",
    "Parking fees",
    "Tax",
  ],

  excludes: [
    "Attraction entrance fees",
    "Meals and beverages",
    "Tips",
  ],

  schedule: [
    {
      time: "08:40",
      title: "Hotel Pickup",
      description: "Please wait in the hotel lobby 10 minutes before your scheduled pickup time",
    },
    {
      time: "09:00-17:00",
      title: "Customizable Tour",
      description: "Explore Jeju's main attractions based on your chosen route (East/West/South route)",
    },
    {
      time: "17:40",
      title: "Hotel Drop-off",
      description: "Return safely to your hotel",
    },
  ],

  faqs: [
    {
      question: "What time is the pickup?",
      answer: "Pickup time will be confirmed via WhatsApp by 8 PM the day before the tour. If you don't receive a message, please contact us.",
    },
    {
      question: "What are the overtime charges?",
      answer: "Overtime charges of 25,000 won per hour apply for vehicle use exceeding 9 hours. Payment is made in cash directly to the driver.",
    },
    {
      question: "Can we visit multiple regions?",
      answer: "Private tour itineraries are limited to one region per day. Visiting two different islands incurs an additional 60,000 won round-trip fee.",
    },
    {
      question: "What languages does the guide speak?",
      answer: "Professional driver-guides are available in English, Chinese, and Korean.",
    },
    {
      question: "Is free cancellation available?",
      answer: "Yes, cancel up to 24 hours in advance for a full refund.",
    },
    {
      question: "Can I reserve now and pay later?",
      answer: "Yes, keep your travel plans flexible. Book your spot now and pay nothing today.",
    },
    {
      question: "Is the tour wheelchair accessible?",
      answer: "Yes, the tour is wheelchair accessible. Please inform us in advance so we can make necessary arrangements.",
    },
    {
      question: "What is the maximum group size?",
      answer: "The tour accommodates up to 6 people per group for a private experience.",
    },
  ],

  rating: 4.8,
  review_count: 154,
  pickup_points_count: 0,
  dropoff_points_count: 0,
  is_active: true,
  is_featured: true,
};

// 투어 생성 함수 (이미지 URL 포함)
async function createTour(imageUrl, galleryUrls = []) {
  try {
    // Get token from localStorage
    let token = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('auth')) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          token = data?.access_token || data?.accessToken || data?.session?.access_token || data?.currentSession?.access_token;
          if (token) break;
        } catch (e) {}
      }
    }
    
    if (!token) {
      console.error('❌ 인증 토큰을 찾을 수 없습니다. /admin에서 로그인하세요.');
      return;
    }

    const dataToSend = {
      ...tourData,
      image_url: imageUrl || tourData.image_url,
      gallery_images: galleryUrls.length > 0 ? galleryUrls : tourData.gallery_images,
    };

    console.log('🚀 Creating Jeju Private Car Charter Tour...');
    console.log('📋 Tour data:', dataToSend);

    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify(dataToSend),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to create tour:', result);
      throw new Error(result.error || 'Failed to create tour');
    }

    console.log('✅ Tour created successfully!');
    console.log('📦 Tour ID:', result.data?.id);
    console.log('🔗 View tour:', `/admin/products`);
    console.log('📄 Full response:', result);

    return result;
  } catch (error) {
    console.error('❌ Error creating tour:', error);
    throw error;
  }
}

// 이미지 업로드 후 투어 생성
async function createTourWithImages() {
  try {
    console.log('📸 이미지 업로드를 시작합니다...');
    console.log('💡 1. 썸네일 이미지를 선택하세요');
    
    // 썸네일 이미지 선택
    const thumbnailInput = document.createElement('input');
    thumbnailInput.type = 'file';
    thumbnailInput.accept = 'image/*';
    thumbnailInput.onchange = async (e) => {
      const thumbnailFile = e.target.files[0];
      if (!thumbnailFile) {
        console.log('❌ 썸네일 이미지가 선택되지 않았습니다.');
        return;
      }
      
      try {
        const thumbnailUrl = await uploadImage(thumbnailFile, 'tours', 'product');
        console.log('✅ 썸네일 업로드 완료:', thumbnailUrl);
        
        console.log('💡 2. 갤러리 이미지들을 선택하세요 (여러 개 선택 가능)');
        
        // 갤러리 이미지 선택
        const galleryInput = document.createElement('input');
        galleryInput.type = 'file';
        galleryInput.accept = 'image/*';
        galleryInput.multiple = true;
        galleryInput.onchange = async (e) => {
          const galleryFiles = Array.from(e.target.files);
          
          let galleryUrls = [];
          if (galleryFiles.length > 0) {
            try {
              galleryUrls = await uploadMultipleImages(galleryFiles, 'tours/gallery', 'gallery');
            } catch (error) {
              console.warn('⚠️ 갤러리 이미지 업로드 실패, 기본 이미지 사용:', error);
            }
          }
          
          // 투어 생성
          console.log('🚀 투어 생성 중...');
          await createTour(thumbnailUrl, galleryUrls);
        };
        
        galleryInput.click();
      } catch (error) {
        console.error('❌ 썸네일 업로드 실패:', error);
        console.log('💡 기본 이미지로 투어를 생성합니다...');
        await createTour();
      }
    };
    
    thumbnailInput.click();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// 이미지 없이 투어 생성 (기본 이미지 사용)
async function createTourWithoutImages() {
  console.log('🚀 기본 이미지로 투어 생성 중...');
  await createTour();
}

// 브라우저 콘솔에서 사용할 수 있도록 전역 함수로 등록
if (typeof window !== 'undefined') {
  window.createJejuPrivateCarTour = createTourWithImages;
  window.createJejuPrivateCarTourWithoutImages = createTourWithoutImages;
  
  console.log('✅ 스크립트 로드 완료!');
  console.log('💡 사용 방법:');
  console.log('   - createJejuPrivateCarTour() : 이미지 업로드 후 투어 생성');
  console.log('   - createJejuPrivateCarTourWithoutImages() : 기본 이미지로 투어 생성');
  console.log('');
  console.log('🚀 바로 시작하려면: createJejuPrivateCarTour()');
} else {
  console.log('💡 This script should be run in the browser console after logging in as admin.');
  console.log('💡 Steps:');
  console.log('   1. Go to /admin and login');
  console.log('   2. Open browser console (F12)');
  console.log('   3. Copy and paste this script');
  console.log('   4. Run: createJejuPrivateCarTour()');
}

