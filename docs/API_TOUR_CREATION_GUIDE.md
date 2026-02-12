# API로 투어 추가하기 - 완전 가이드

## 📋 목차

1. [사전 준비](#1-사전-준비)
2. [방법 1: 브라우저 콘솔 사용 (가장 쉬움)](#방법-1-브라우저-콘솔-사용-가장-쉬움)
3. [방법 2: curl 명령어 사용](#방법-2-curl-명령어-사용)
4. [방법 3: Postman 사용](#방법-3-postman-사용)
5. [필수 필드와 선택 필드](#필수-필드와-선택-필드)
6. [에러 해결](#에러-해결)

---

## 1. 사전 준비

### 1.1 Admin 계정 준비

API로 투어를 추가하려면 **Admin 권한**이 필요합니다.

#### Admin 계정이 없는 경우:

1. **Supabase Dashboard에서 사용자 생성**
   - Supabase Dashboard → Authentication → Users
   - "Add user" 클릭
   - Email: `admin@atockorea.com`
   - Password: 설정
   - ✅ "Auto Confirm User" 체크
   - "Create user" 클릭
   - **User UID 복사** (나중에 필요)

2. **SQL Editor에서 Admin 역할 부여**
   ```sql
   -- YOUR_USER_ID를 방금 복사한 User UID로 교체
   INSERT INTO user_profiles (id, full_name, role)
   VALUES ('YOUR_USER_ID', 'Admin User', 'admin')
   ON CONFLICT (id) DO UPDATE SET role = 'admin';
   ```

자세한 내용은 `docs/CREATE_ADMIN_STEP_BY_STEP.md` 참고

### 1.2 Admin으로 로그인

1. 브라우저에서 사이트 접속
   - 로컬: `http://localhost:3000`
   - 프로덕션: `https://your-domain.com`

2. 로그인 페이지 접속
   - `/admin` 또는 `/signin`

3. Admin 계정으로 로그인
   - Email: `admin@atockorea.com`
   - Password: 설정한 비밀번호

4. ✅ 로그인 확인
   - Admin 대시보드가 보이면 성공!

---

## 방법 1: 브라우저 콘솔 사용 (가장 쉬움)

### 단계별 가이드

#### 1단계: 브라우저 개발자 도구 열기

- **Chrome/Edge**: `F12` 또는 `Ctrl+Shift+I` (Mac: `Cmd+Option+I`)
- **Firefox**: `F12` 또는 `Ctrl+Shift+K`

#### 2단계: Console 탭 선택

- 개발자 도구 상단의 **Console** 탭 클릭

#### 3단계: 스크립트 실행

**옵션 A: 기존 스크립트 사용 (간단)**

1. `scripts/add-jeju-cruise-tour-simple.js` 파일 열기
2. 전체 내용 복사 (`Ctrl+A`, `Ctrl+C`)
3. 브라우저 콘솔에 붙여넣기 (`Ctrl+V`)
4. Enter 키 누르기
5. 결과 확인

**옵션 B: 직접 작성 (커스터마이징)**

아래 코드를 콘솔에 붙여넣고 데이터만 수정:

```javascript
(async () => {
  const tourData = {
    // ===== 필수 필드 =====
    title: "투어 제목",
    slug: "tour-slug-unique", // URL에 사용, 고유해야 함
    city: "Jeju", // "Seoul", "Busan", "Jeju" 중 하나
    price: 88000,
    price_type: "person", // "person" 또는 "group"
    image_url: "https://images.unsplash.com/photo-xxx",
    
    // ===== 선택 필드 =====
    tag: "Cruise",
    subtitle: "Top rated",
    description: "투어 설명...",
    original_price: 96000,
    duration: "8 hours",
    lunch_included: false,
    ticket_included: true,
    
    // 이미지 갤러리 (배열)
    gallery_images: [
      "https://images.unsplash.com/photo-1.jpg",
      "https://images.unsplash.com/photo-2.jpg"
    ],
    
    // 픽업 정보
    pickup_info: "픽업 안내...",
    notes: "주의사항...",
    
    // 하이라이트 (배열)
    highlights: [
      "하이라이트 1",
      "하이라이트 2"
    ],
    
    // 포함 사항 (배열)
    includes: [
      "포함 항목 1",
      "포함 항목 2"
    ],
    
    // 불포함 사항 (배열)
    excludes: [
      "불포함 항목 1"
    ],
    
    // 일정 (객체 배열)
    schedule: [
      {
        time: "09:00",
        title: "첫 번째 장소",
        description: "설명..."
      },
      {
        time: "12:00",
        title: "두 번째 장소",
        description: "설명..."
      }
    ],
    
    // FAQ (객체 배열)
    faqs: [
      {
        question: "질문 1?",
        answer: "답변 1"
      },
      {
        question: "질문 2?",
        answer: "답변 2"
      }
    ],
    
    // 픽업 포인트 (객체 배열, 선택)
    pickup_points: [
      {
        name: "픽업 장소 이름",
        address: "주소",
        lat: 33.2375,  // 위도
        lng: 126.5778, // 경도
        pickup_time: "09:00:00" // 또는 null
      }
    ],
    
    // 기타
    rating: 4.8,
    review_count: 138,
    pickup_points_count: 2,
    dropoff_points_count: 2,
    is_active: true,
    is_featured: true
  };
  
  try {
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 쿠키 전송 (중요!)
      body: JSON.stringify(tourData)
    });
    
    const result = await response.json();
    
    if (result.data) {
      console.log('✅ 투어 생성 성공!', result.data);
      alert(`✅ 투어 생성 성공!\n\nID: ${result.data.id}\n제목: ${result.data.title}\nSlug: ${result.data.slug}`);
    } else {
      console.error('❌ 투어 생성 실패:', result.error);
      alert('❌ 실패: ' + (result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('❌ 에러:', error);
    alert('❌ 에러: ' + error.message);
  }
})();
```

#### 4단계: 결과 확인

- ✅ 성공: 콘솔에 "투어 생성 성공!" 메시지
- ❌ 실패: 에러 메시지 확인 (아래 [에러 해결](#에러-해결) 참고)

---

## 방법 2: curl 명령어 사용

### 1단계: Access Token 가져오기

**브라우저 콘솔에서 실행:**

```javascript
// 쿠키에서 토큰 추출
const cookies = document.cookie.split(';');
let token = null;
for (const cookie of cookies) {
  const [name, value] = cookie.split('=').map(c => decodeURIComponent(c.trim()));
  if (name.includes('auth-token')) {
    try {
      const parsed = JSON.parse(value);
      token = parsed?.access_token || parsed?.session?.access_token;
      if (token) break;
    } catch (e) {
      // Not JSON
    }
  }
}
console.log('Token:', token);
// 이 토큰을 복사하세요
```

### 2단계: curl 명령어 실행

**터미널에서 실행:**

```bash
curl -X POST http://localhost:3000/api/admin/tours \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "title": "투어 제목",
    "slug": "tour-slug",
    "city": "Jeju",
    "price": 88000,
    "price_type": "person",
    "image_url": "https://images.unsplash.com/photo-xxx",
    "tag": "Cruise",
    "description": "투어 설명..."
  }'
```

**주의사항:**
- `YOUR_ACCESS_TOKEN`을 실제 토큰으로 교체
- 토큰은 만료 시간이 있음 (보통 1시간)
- 만료되면 다시 로그인 후 토큰 가져오기

---

## 방법 3: Postman 사용

### 1단계: 새 Request 생성

1. Postman 열기
2. "New" → "HTTP Request" 클릭
3. Method: **POST** 선택
4. URL: `http://localhost:3000/api/admin/tours`

### 2단계: Headers 설정

**Headers 탭에서 추가:**

| Key | Value |
|-----|-------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer YOUR_ACCESS_TOKEN` |

*YOUR_ACCESS_TOKEN은 [방법 2](#1단계-access-token-가져오기)에서 가져온 토큰*

### 3단계: Body 설정

**Body 탭:**
1. **raw** 선택
2. **JSON** 선택
3. 아래 예시 복사하여 수정:

```json
{
  "title": "투어 제목",
  "slug": "tour-slug",
  "city": "Jeju",
  "price": 88000,
  "price_type": "person",
  "image_url": "https://images.unsplash.com/photo-xxx",
  "tag": "Cruise",
  "description": "투어 설명...",
  "is_active": true,
  "is_featured": false
}
```

### 4단계: Send 클릭

- ✅ 성공: 201 Created 응답
- ❌ 실패: 에러 메시지 확인

---

## 필수 필드와 선택 필드

### ✅ 필수 필드

반드시 제공해야 하는 필드:

```typescript
{
  title: string,        // 투어 제목
  slug: string,         // URL용 고유 식별자 (영문, 하이픈)
  city: "Seoul" | "Busan" | "Jeju",  // 도시
  price: number,        // 가격 (숫자)
  price_type: "person" | "group",  // 가격 타입
  image_url: string     // 메인 이미지 URL
}
```

### 📝 선택 필드

없어도 되지만 있으면 좋은 필드:

```typescript
{
  // 기본 정보
  tag?: string,              // 태그
  subtitle?: string,         // 부제목
  description?: string,      // 설명
  original_price?: number,   // 원래 가격 (할인 표시용)
  duration?: string,         // 소요 시간 (예: "8 hours")
  
  // 불린 값
  lunch_included?: boolean,  // 점심 포함 여부
  ticket_included?: boolean, // 티켓 포함 여부
  is_active?: boolean,       // 활성화 여부 (기본: true)
  is_featured?: boolean,     // 추천 여부 (기본: false)
  
  // 배열
  gallery_images?: string[], // 갤러리 이미지 URL 배열
  highlights?: string[],     // 하이라이트 배열
  includes?: string[],       // 포함 사항 배열
  excludes?: string[],       // 불포함 사항 배열
  
  // 객체 배열
  schedule?: Array<{         // 일정
    time: string,
    title: string,
    description?: string
  }>,
  faqs?: Array<{            // FAQ
    question: string,
    answer: string
  }>,
  pickup_points?: Array<{   // 픽업 포인트
    name: string,
    address: string,
    lat?: number,
    lng?: number,
    pickup_time?: string | null
  }>,
  
  // 기타
  pickup_info?: string,     // 픽업 정보 텍스트
  notes?: string,           // 주의사항
  rating?: number,          // 평점 (0-5)
  review_count?: number,    // 리뷰 개수
  pickup_points_count?: number,
  dropoff_points_count?: number
}
```

---

## 에러 해결

### ❌ "Unauthorized" (401)

**원인:** 로그인되지 않았거나 쿠키가 없음

**해결:**
1. `/admin` 또는 `/signin`에서 Admin 계정으로 로그인
2. 브라우저 콘솔에서 다시 실행
3. `credentials: 'include'` 확인 (쿠키 전송)

### ❌ "Forbidden" (403)

**원인:** Admin 권한이 없음

**해결:**
1. Supabase SQL Editor에서 역할 확인:
   ```sql
   SELECT id, email, role FROM user_profiles WHERE email = 'admin@atockorea.com';
   ```
2. Admin 역할이 아니면 설정:
   ```sql
   UPDATE user_profiles SET role = 'admin' WHERE email = 'admin@atockorea.com';
   ```

### ❌ "Missing required field: xxx"

**원인:** 필수 필드가 누락됨

**해결:**
- 에러 메시지에서 누락된 필드 확인
- 해당 필드를 tourData에 추가

### ❌ "duplicate key value violates unique constraint"

**원인:** slug가 이미 존재함

**해결:**
- 다른 slug 값 사용 (예: `tour-slug-2`)

### ❌ 네트워크 에러

**원인:** 서버가 실행되지 않았거나 URL이 잘못됨

**해결:**
1. 로컬 개발 서버 실행 확인: `npm run dev`
2. URL 확인: `http://localhost:3000` (로컬) 또는 실제 도메인

---

## 완전한 예시

실제 사용 가능한 완전한 예시:

```javascript
(async () => {
  const tourData = {
    // 필수 필드
    title: "Jeju Island: Full Day Tour for Cruise Ship Passengers",
    slug: "jeju-island-full-day-tour-cruise-passengers-" + Date.now(), // 고유성 보장
    city: "Jeju",
    price: 88000,
    price_type: "person",
    image_url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200&q=80",
    
    // 선택 필드
    tag: "Cruise",
    subtitle: "Top rated",
    description: "Exclusive Jeju tour for cruise guests...",
    original_price: 88000,
    duration: "8 hours",
    lunch_included: false,
    ticket_included: true,
    
    gallery_images: [
      "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&h=600&fit=crop",
      "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&h=600&fit=crop"
    ],
    
    pickup_info: "We will be waiting for you according to the cruise ship's schedule...",
    notes: "Tour time may change depending on cruise arrival and departure times...",
    
    highlights: [
      "Tailored tours for cruise guests with on-time pick-up & drop-off guaranteed",
      "Enjoy a seamless tour aligned with cruise schedules"
    ],
    
    includes: [
      "Professional guide",
      "Cruise port pickup and drop-off",
      "Comfortable vehicle"
    ],
    
    excludes: [
      "Lunch costs",
      "Personal expenses",
      "Tips"
    ],
    
    schedule: [
      {
        time: "Variable",
        title: "Pickup - Cruise Terminal",
        description: "Pickup at cruise terminal according to cruise ship schedule..."
      },
      {
        time: "Variable",
        title: "Seongsan Ilchulbong",
        description: "UNESCO World Natural Heritage site..."
      }
    ],
    
    faqs: [
      {
        question: "Which port will my cruise dock at?",
        answer: "There are two ports in Jeju Island: Jeju Port and Gangjeong Seogwipo Port."
      },
      {
        question: "What time will I be picked up?",
        answer: "Pickup is arranged based on your cruise ship's schedule."
      }
    ],
    
    pickup_points: [
      {
        name: "Seogwipo Gangjeong Cruise Terminal",
        address: "Seogwipo Gangjeong Cruise Terminal, Gangjeong-dong, Seogwipo-si, Jeju-do",
        lat: 33.2375,
        lng: 126.5778,
        pickup_time: null
      }
    ],
    
    rating: 4.8,
    review_count: 138,
    pickup_points_count: 1,
    dropoff_points_count: 1,
    is_active: true,
    is_featured: true
  };
  
  try {
    const response = await fetch('/api/admin/tours', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(tourData)
    });
    
    const result = await response.json();
    
    if (result.data) {
      console.log('✅ 투어 생성 성공!', result.data);
      alert(`✅ 투어 생성 성공!\n\nID: ${result.data.id}\n제목: ${result.data.title}`);
    } else {
      console.error('❌ 투어 생성 실패:', result);
      alert('❌ 실패: ' + (result.error || JSON.stringify(result)));
    }
  } catch (error) {
    console.error('❌ 에러:', error);
    alert('❌ 에러: ' + error.message);
  }
})();
```

---

## 요약

**가장 쉬운 방법:**
1. ✅ Admin 계정으로 로그인 (`/admin`)
2. ✅ 브라우저 콘솔 열기 (`F12`)
3. ✅ 위의 완전한 예시 코드 복사
4. ✅ 데이터 수정
5. ✅ 붙여넣기 후 Enter
6. ✅ 성공!

**문제가 있으면:**
- 콘솔 에러 메시지 확인
- 위의 [에러 해결](#에러-해결) 섹션 참고
- 또는 `docs/ADMIN_LOGIN_GUIDE_KR.md` 참고











