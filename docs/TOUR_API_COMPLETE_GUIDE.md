# 투어 추가 API 완전 가이드

API를 통해 모든 정보(문구, 사진 포함)를 한 번에 보내서 투어를 추가할 수 있습니다.

## 📋 API 엔드포인트

**POST** `/api/admin/tours`

## 🔐 인증

- Admin 또는 Merchant 권한 필요
- 세션 쿠키를 통한 인증 (브라우저에서 자동 처리)

## 📝 필수 필드

다음 필드는 반드시 포함해야 합니다:

- `title`: 투어 제목 (예: "제주도 동부 유네스코 투어")
- `slug`: URL 슬러그 (예: "jeju-eastern-unesco-tour") - 고유해야 함
- `city`: 도시 (예: "Jeju", "Busan", "Seoul")
- `price`: 가격 (숫자)
- `price_type`: 가격 타입 ("person" 또는 "group")
- `image_url`: 메인 이미지 URL

## 📦 전체 데이터 구조 예시

```typescript
{
  // ===== 필수 필드 =====
  "title": "제주도 동부 유네스코 지질공원 투어",
  "slug": "jeju-eastern-unesco-tour",
  "city": "Jeju",
  "price": 80000,
  "price_type": "person",
  "image_url": "https://example.com/images/jeju-tour-main.jpg",
  
  // ===== 기본 정보 =====
  "tag": "유네스코",
  "subtitle": "세계자연유산을 탐험하는 특별한 하루",
  "description": "제주도 동부 지역의 유네스코 세계자연유산을 탐험하는 풀데이 투어입니다. 성산일출봉, 만장굴, 섭지코지 등 아름다운 자연 경관을 만나보세요.",
  "original_price": 100000,  // 할인 전 가격 (선택)
  
  // ===== 이미지 =====
  "gallery_images": [
    "https://example.com/images/jeju-tour-1.jpg",
    "https://example.com/images/jeju-tour-2.jpg",
    "https://example.com/images/jeju-tour-3.jpg"
  ],
  
  // ===== 투어 상세 정보 =====
  "duration": "09:00–17:00 · 8 hours",
  "lunch_included": true,
  "ticket_included": true,
  "pickup_info": "제주시내 호텔 픽업 가능",
  "notes": "산행이 포함되어 있으니 편한 복장을 권장합니다.",
  
  // ===== 하이라이트 =====
  "highlights": [
    "성산일출봉 등반",
    "만장굴 탐험",
    "섭지코지 해안 산책",
    "전문 가이드 동행",
    "중식 포함"
  ],
  
  // ===== 포함 사항 =====
  "includes": [
    "전문 가이드",
    "왕복 교통",
    "중식 (한정식)",
    "입장료",
    "보험"
  ],
  
  // ===== 불포함 사항 =====
  "excludes": [
    "개인 경비",
    "선택 투어",
    "팁"
  ],
  
  // ===== 일정표 =====
  "schedule": [
    {
      "time": "09:00",
      "title": "호텔 픽업",
      "description": "제주시내 호텔에서 픽업"
    },
    {
      "time": "10:00",
      "title": "성산일출봉 도착",
      "description": "세계자연유산 성산일출봉 등반 시작"
    },
    {
      "time": "12:30",
      "title": "중식",
      "description": "제주 전통 한정식"
    },
    {
      "time": "14:00",
      "title": "만장굴 탐험",
      "description": "용암동굴 탐험"
    },
    {
      "time": "15:30",
      "title": "섭지코지",
      "description": "해안 산책 및 사진 촬영"
    },
    {
      "time": "17:00",
      "title": "호텔 도착",
      "description": "제주시내 호텔로 귀환"
    }
  ],
  
  // ===== FAQ =====
  "faqs": [
    {
      "question": "몇 명까지 예약 가능한가요?",
      "answer": "최대 15명까지 예약 가능합니다."
    },
    {
      "question": "날씨가 나쁘면 취소되나요?",
      "answer": "악천후 시 안전을 위해 투어가 취소될 수 있습니다. 전액 환불해드립니다."
    },
    {
      "question": "어린이도 참여 가능한가요?",
      "answer": "만 5세 이상부터 참여 가능하며, 보호자 동반 필수입니다."
    }
  ],
  
  // ===== 픽업 지점 =====
  "pickup_points": [
    {
      "name": "제주국제공항",
      "address": "제주특별자치도 제주시 공항로 2",
      "lat": 33.5113,
      "lng": 126.4930,
      "pickup_time": "09:00:00"
    },
    {
      "name": "제주시내 호텔",
      "address": "제주특별자치도 제주시 노형동",
      "lat": 33.4996,
      "lng": 126.5312,
      "pickup_time": "09:15:00"
    }
  ],
  
  // ===== 메타데이터 =====
  "rating": 4.8,
  "review_count": 127,
  "pickup_points_count": 2,
  "dropoff_points_count": 1,
  "is_active": true,
  "is_featured": true
}
```

## 💻 사용 예시

### JavaScript/TypeScript

```typescript
async function createTour() {
  const tourData = {
    title: "제주도 동부 유네스코 지질공원 투어",
    slug: "jeju-eastern-unesco-tour",
    city: "Jeju",
    price: 80000,
    price_type: "person",
    image_url: "https://example.com/images/jeju-tour-main.jpg",
    subtitle: "세계자연유산을 탐험하는 특별한 하루",
    description: "제주도 동부 지역의 유네스코 세계자연유산을 탐험하는 풀데이 투어입니다.",
    gallery_images: [
      "https://example.com/images/jeju-tour-1.jpg",
      "https://example.com/images/jeju-tour-2.jpg"
    ],
    duration: "09:00–17:00 · 8 hours",
    lunch_included: true,
    ticket_included: true,
    highlights: [
      "성산일출봉 등반",
      "만장굴 탐험",
      "섭지코지 해안 산책"
    ],
    includes: [
      "전문 가이드",
      "왕복 교통",
      "중식 (한정식)",
      "입장료"
    ],
    excludes: [
      "개인 경비",
      "선택 투어"
    ],
    schedule: [
      {
        time: "09:00",
        title: "호텔 픽업",
        description: "제주시내 호텔에서 픽업"
      },
      {
        time: "10:00",
        title: "성산일출봉 도착",
        description: "세계자연유산 성산일출봉 등반 시작"
      }
    ],
    faqs: [
      {
        question: "몇 명까지 예약 가능한가요?",
        answer: "최대 15명까지 예약 가능합니다."
      }
    ],
    pickup_points: [
      {
        name: "제주국제공항",
        address: "제주특별자치도 제주시 공항로 2",
        lat: 33.5113,
        lng: 126.4930,
        pickup_time: "09:00:00"
      }
    ],
    is_active: true,
    is_featured: true
  };

  try {
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 쿠키 포함
      body: JSON.stringify(tourData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('투어 생성 성공:', result.data);
      return result.data;
    } else {
      console.error('투어 생성 실패:', result.error);
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('에러:', error);
    throw error;
  }
}
```

### cURL

```bash
curl -X POST http://localhost:3000/api/admin/tours \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "title": "제주도 동부 유네스코 지질공원 투어",
    "slug": "jeju-eastern-unesco-tour",
    "city": "Jeju",
    "price": 80000,
    "price_type": "person",
    "image_url": "https://example.com/images/jeju-tour-main.jpg",
    "subtitle": "세계자연유산을 탐험하는 특별한 하루",
    "description": "제주도 동부 지역의 유네스코 세계자연유산을 탐험하는 풀데이 투어입니다.",
    "gallery_images": [
      "https://example.com/images/jeju-tour-1.jpg",
      "https://example.com/images/jeju-tour-2.jpg"
    ],
    "duration": "09:00–17:00 · 8 hours",
    "lunch_included": true,
    "ticket_included": true,
    "highlights": [
      "성산일출봉 등반",
      "만장굴 탐험",
      "섭지코지 해안 산책"
    ],
    "includes": [
      "전문 가이드",
      "왕복 교통",
      "중식 (한정식)",
      "입장료"
    ],
    "schedule": [
      {
        "time": "09:00",
        "title": "호텔 픽업",
        "description": "제주시내 호텔에서 픽업"
      }
    ],
    "pickup_points": [
      {
        "name": "제주국제공항",
        "address": "제주특별자치도 제주시 공항로 2",
        "lat": 33.5113,
        "lng": 126.4930,
        "pickup_time": "09:00:00"
      }
    ],
    "is_active": true
  }'
```

### Python

```python
import requests
import json

def create_tour():
    url = "http://localhost:3000/api/admin/tours"
    
    tour_data = {
        "title": "제주도 동부 유네스코 지질공원 투어",
        "slug": "jeju-eastern-unesco-tour",
        "city": "Jeju",
        "price": 80000,
        "price_type": "person",
        "image_url": "https://example.com/images/jeju-tour-main.jpg",
        "subtitle": "세계자연유산을 탐험하는 특별한 하루",
        "description": "제주도 동부 지역의 유네스코 세계자연유산을 탐험하는 풀데이 투어입니다.",
        "gallery_images": [
            "https://example.com/images/jeju-tour-1.jpg",
            "https://example.com/images/jeju-tour-2.jpg"
        ],
        "duration": "09:00–17:00 · 8 hours",
        "lunch_included": True,
        "ticket_included": True,
        "highlights": [
            "성산일출봉 등반",
            "만장굴 탐험",
            "섭지코지 해안 산책"
        ],
        "includes": [
            "전문 가이드",
            "왕복 교통",
            "중식 (한정식)",
            "입장료"
        ],
        "schedule": [
            {
                "time": "09:00",
                "title": "호텔 픽업",
                "description": "제주시내 호텔에서 픽업"
            }
        ],
        "pickup_points": [
            {
                "name": "제주국제공항",
                "address": "제주특별자치도 제주시 공항로 2",
                "lat": 33.5113,
                "lng": 126.4930,
                "pickup_time": "09:00:00"
            }
        ],
        "is_active": True
    }
    
    # 세션 쿠키 포함 (실제 사용 시 쿠키 설정 필요)
    cookies = {
        'your-session-cookie': 'your-cookie-value'
    }
    
    response = requests.post(
        url,
        headers={'Content-Type': 'application/json'},
        cookies=cookies,
        data=json.dumps(tour_data)
    )
    
    if response.status_code == 201:
        result = response.json()
        print('투어 생성 성공:', result['data'])
        return result['data']
    else:
        print('투어 생성 실패:', response.json())
        return None
```

## ✅ 응답 예시

### 성공 응답 (201 Created)

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "제주도 동부 유네스코 지질공원 투어",
    "slug": "jeju-eastern-unesco-tour",
    "city": "Jeju",
    "price": 80000,
    "price_type": "person",
    "image_url": "https://example.com/images/jeju-tour-main.jpg",
    "gallery_images": [
      "https://example.com/images/jeju-tour-1.jpg",
      "https://example.com/images/jeju-tour-2.jpg"
    ],
    "highlights": [
      "성산일출봉 등반",
      "만장굴 탐험",
      "섭지코지 해안 산책"
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "message": "Tour created successfully"
}
```

### 에러 응답

```json
{
  "error": "Missing required field: title"
}
```

또는

```json
{
  "error": "duplicate key value violates unique constraint \"tours_slug_key\""
}
```

## 📌 필드 설명

### 필수 필드

| 필드 | 타입 | 설명 | 예시 |
|------|------|------|------|
| `title` | string | 투어 제목 | "제주도 동부 유네스코 지질공원 투어" |
| `slug` | string | URL 슬러그 (고유) | "jeju-eastern-unesco-tour" |
| `city` | string | 도시 | "Jeju", "Busan", "Seoul" |
| `price` | number | 가격 | 80000 |
| `price_type` | string | 가격 타입 | "person" 또는 "group" |
| `image_url` | string | 메인 이미지 URL | "https://..." |

### 선택 필드

| 필드 | 타입 | 설명 | 기본값 |
|------|------|------|--------|
| `tag` | string | 태그 | null |
| `subtitle` | string | 부제목 | null |
| `description` | string | 상세 설명 | null |
| `original_price` | number | 할인 전 가격 | null |
| `gallery_images` | string[] | 갤러리 이미지 배열 | [] |
| `duration` | string | 소요 시간 | null |
| `lunch_included` | boolean | 중식 포함 여부 | false |
| `ticket_included` | boolean | 입장료 포함 여부 | false |
| `pickup_info` | string | 픽업 정보 | null |
| `notes` | string | 참고사항 | null |
| `highlights` | string[] | 하이라이트 배열 | [] |
| `includes` | string[] | 포함 사항 배열 | [] |
| `excludes` | string[] | 불포함 사항 배열 | [] |
| `schedule` | object[] | 일정표 배열 | [] |
| `faqs` | object[] | FAQ 배열 | [] |
| `pickup_points` | object[] | 픽업 지점 배열 | [] |
| `rating` | number | 평점 | 0 |
| `review_count` | number | 리뷰 수 | 0 |
| `is_active` | boolean | 활성화 여부 | true |
| `is_featured` | boolean | 추천 투어 여부 | false |

### Schedule 객체 구조

```typescript
{
  time: string;        // "09:00"
  title: string;      // "호텔 픽업"
  description?: string; // "제주시내 호텔에서 픽업" (선택)
}
```

### FAQ 객체 구조

```typescript
{
  question: string;   // "몇 명까지 예약 가능한가요?"
  answer: string;     // "최대 15명까지 예약 가능합니다."
}
```

### Pickup Point 객체 구조

```typescript
{
  name: string;       // "제주국제공항"
  address: string;    // "제주특별자치도 제주시 공항로 2"
  lat?: number;       // 33.5113 (선택)
  lng?: number;       // 126.4930 (선택)
  pickup_time?: string; // "09:00:00" (선택)
}
```

## ⚠️ 주의사항

1. **slug는 고유해야 함**: 이미 존재하는 slug를 사용하면 에러가 발생합니다.
2. **이미지 URL**: 이미지는 외부 URL이거나 Supabase Storage에 업로드된 URL이어야 합니다.
3. **인증**: Admin 또는 Merchant 권한이 필요합니다.
4. **city 값**: "Jeju", "Busan", "Seoul" 중 하나여야 합니다.
5. **price_type 값**: "person" 또는 "group" 중 하나여야 합니다.

## 🔄 업데이트

투어를 업데이트하려면 **PUT** `/api/admin/tours/[id]` 엔드포인트를 사용하세요.

## 📚 관련 문서

- [투어 관리 가이드](./TOUR_MANAGEMENT_GUIDE.md)
- [API 문서](./API_DOCUMENTATION.md)










