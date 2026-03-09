# 네이티브 앱 개발 계획 (레이아웃 동일, 신규 앱)

웹뷰가 아닌 **완전한 네이티브 앱**을 만들되, 웹과 **동일한 레이아웃·플로우**를 유지합니다.

---

## 접근 방식

| 항목 | 내용 |
|------|------|
| **스택** | **Expo (React Native)** + TypeScript |
| **레이아웃** | 웹과 동일한 화면 구성 (히어로 → 결제 안내 → 트러스트바 → 목적지 → 인기 투어 → 투어 목록) |
| **API** | 기존 웹 백엔드 그대로 사용 (`https://atockorea.com/api/...`) |
| **코드** | 앱 전용 UI (React Native 컴포넌트), 타입·API 호출 로직은 웹과 맞춤 |

---

## 웹 vs 앱 화면 대응

| 웹 (Next.js) | 앱 (Expo) |
|--------------|-----------|
| `/` (Header + Hero + PaymentStrip + TrustBar + Destinations + HomeTourSections + TourList) | **Home** 탭: 동일 블록 순서 |
| `/tours` | **Tours** 탭 (필터 + 리스트) |
| `/tour/[id]`, `/jeju/[slug]` | **TourDetail** 스크린 |
| `/cart` | **Cart** 탭 |
| `/mypage/*` | **Profile** 탭 (예약 목록, 설정 등) |
| 로그인/회원가입 | **Auth** 스크린 (모달 또는 스택) |

---

## 앱 폴더 구조 (mobile/)

```
mobile/
├── App.tsx                 # 진입점, 네비게이션 루트
├── app.json                # Expo 설정
├── package.json
├── src/
│   ├── api/
│   │   └── client.ts       # BASE_URL = https://atockorea.com
│   ├── components/         # 히어로, 트러스트바, 투어 카드 등 (웹 레이아웃 반영)
│   ├── constants/
│   │   └── theme.ts        # 웹과 맞춘 색상/간격
│   ├── navigation/
│   │   ├── TabNavigator.tsx # Home | Tours | Cart | Profile
│   │   └── StackNavigator.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx   # Hero → PaymentStrip → TrustBar → Destinations → PopularTours → TourList
│   │   ├── ToursScreen.tsx
│   │   ├── TourDetailScreen.tsx
│   │   ├── CartScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── types/
│       └── tour.ts         # 웹 API 응답과 동일한 타입
```

---

## API 사용

- **Base URL**: `https://atockorea.com` (또는 `EXPO_PUBLIC_APP_URL` 환경 변수)
- **엔드포인트**: 웹과 동일  
  - `GET /api/tours` (목록, 필터)  
  - `GET /api/tours/[id]` (상세)  
  - `GET /api/cart`, `POST /api/cart`, `DELETE /api/cart/[id]`  
  - `GET /api/bookings`, `POST /api/bookings`  
  - 인증: Supabase 또는 웹과 동일한 세션/토큰 방식
- **이미지**: 웹과 동일한 CDN/경로 사용 (절대 URL)

---

## 디자인 일치

- **색상**: 웹 Tailwind 기준 (primary blue, 배경 그라데이션 등) → `theme.ts`에 정의
- **블록 순서**: 홈은 웹과 동일하게 **Hero → Payment strip → Trust bar → Destinations → Popular tours → Tour list**
- **카드/버튼**: 둥근 모서리, 그림자, 폰트 크기는 웹과 비슷하게 조정

---

## 진행 순서

1. ✅ 계획 수립 (본 문서)
2. ✅ Expo 앱 생성 (`mobile/`), 네비게이션·API 클라이언트 구성
3. ✅ Home 화면 구현 (웹과 동일 블록 순서: Hero → PaymentStrip → TrustBar → Destinations → Popular Tours → All Tours)
4. ✅ Tour 상세 화면 (`/tour/[id]`), Tours / Cart / Profile 탭 (골격)
5. 인증 연동 (웹 API·Supabase와 통일)
6. 스토어 배포 (Google Play / App Store)

---

## 실행 방법

```bash
cd mobile
npm install
npm start
```

- **Android**: `npm run android` (에뮬레이터 또는 연결된 기기)
- **iOS**: `npm run ios` (macOS 필요)
- **웹**: `npm run web`

API는 `EXPO_PUBLIC_APP_URL`(기본값: `https://www.atockorea.com`)을 사용합니다.
