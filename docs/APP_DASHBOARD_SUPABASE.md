# 앱 대시보드 & Supabase DB 공유

**모든 데이터는 웹과 앱이 동일한 Supabase 프로젝트를 공유합니다.**

- **인증**: auth.users, user_profiles (웹에서 로그인하든 앱에서 로그인하든 동일 계정)
- **예약**: bookings (웹/앱 예약 모두 같은 테이블)
- **투어·재고·결제·리뷰 등**: tours, product_inventory, payments, reviews 등 동일 DB
- **Tour Mode**: tour_guide_spots, tour_facilities, tour_bus_details 등도 같은 Supabase

앱의 Profile(대시보드)은 웹 마이페이지와 **동일한 기능**을 제공하며, 위 **같은 Supabase DB**를 사용합니다.

## 환경 변수 (mobile)

`mobile/.env` 또는 EAS/Expo 환경에 다음을 설정하세요.

```env
EXPO_PUBLIC_APP_URL=https://www.atockorea.com
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**웹과 동일한 Supabase를 쓰려면** 웹 프로젝트의 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`와 **같은 값**을 `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`에 넣으면 됩니다.

## 구현된 기능

| 기능 | 웹 | 앱 |
|------|----|----|
| 로그인 | 웹 로그인 페이지 | 앱 내 이메일/비밀번호 로그인 (같은 Supabase) |
| 대시보드 | 마이페이지 레이아웃 | Profile 탭: 아바타, 이름, 이메일, 메뉴 |
| My Bookings | /mypage/mybookings | Profile → My Bookings (목록, 취소) |
| Settings | /mypage/settings | Profile → Settings (이름, 전화번호 저장) |
| Sign out | 마이페이지 로그아웃 | Profile → Sign out |
| Cart | /cart | Cart 탭: GET /api/cart로 Supabase cart_items 조회, 웹과 동일 목록 표시·삭제 가능. 결제는 웹에서 진행 |

## 데이터 흐름

- **인증**: 앱에서 `supabase.auth.signInWithPassword` 또는 웹에서 로그인. 동일 Supabase 프로젝트이므로 **동일 user_id**.
- **예약 목록**: 앱에서 `GET /api/bookings` + `Authorization: Bearer <access_token>` 호출. 웹 API가 토큰으로 user를 식별해 해당 유저의 예약만 반환.
- **프로필 수정**: 앱에서 `PATCH /api/auth/update-profile` + Bearer 토큰. 웹과 동일 API, 동일 `user_profiles` 테이블.
- **예약 취소**: 앱에서 `DELETE /api/bookings/:id` + Bearer 토큰.

## 폴더 구조 (mobile)

```
app/(tabs)/profile/
  _layout.tsx   # Stack (Profile, My Bookings, Settings)
  index.tsx     # 대시보드 (로그인 UI 또는 유저 정보 + 메뉴)
  bookings.tsx  # 예약 목록, 취소
  settings.tsx  # 이름/전화번호 수정
```

- `contexts/AuthContext.tsx`: 세션, 프로필, signOut, refreshProfile
- `lib/supabase.ts`: Supabase 클라이언트 (AsyncStorage로 세션 유지)
- `api/client.ts`: apiGet / apiPost / apiPatch / apiDelete 에 `accessToken` 인자 지원

## 회원가입

- **앱**에서도 회원가입 가능 (Profile → Create account). 이메일 인증 → 정보 입력 → 동일 Supabase에 가입.
- **웹**에서 가입한 계정은 앱에서 그대로 로그인 가능 (Create account on web 링크는 웹 가입용).
- 어디서 가입하든 **동일한 auth.users / user_profiles**에 저장되며, 웹·앱 모두 같은 계정으로 사용합니다.
