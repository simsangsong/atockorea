# 앱 Google 로그인 연동

Expo 앱(mobile/)에서 Google 로그인은 **Supabase Auth**를 사용하며, 웹과 **동일한 계정/DB**를 공유합니다.

## 필수 설정

### 1. Supabase 대시보드

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **URL Configuration**
3. **Redirect URLs**에 아래 URL 추가:
   - `mobile://auth/callback` (앱 스킴은 `app.json`의 `scheme: "mobile"` 기준)

개발 시 Expo Go를 쓰면 리다이렉트가 다를 수 있으므로, 실제 기기/시뮬레이터에서 **Development Build**로 테스트하는 것을 권장합니다.

### 2. Google Cloud Console (웹과 동일)

웹에서 이미 Google 로그인을 설정했다면 추가 작업은 없습니다.  
처음 설정하는 경우:

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. OAuth 2.0 Client ID 생성 (Web application)
3. **Supabase Dashboard** → Authentication → Providers → Google 에서 해당 Client ID / Client Secret 입력

## 앱에서 동작

- **Profile** 탭 → 비로그인 시 **Continue with Google** 버튼 표시
- 탭 시 브라우저가 열리고 Google 로그인 후 앱으로 복귀
- 로그인 성공 시 `user_profiles`에 없으면 자동 생성 (웹과 동일)

## 관련 파일

- `mobile/lib/googleAuth.ts` — OAuth URL 생성, 브라우저 열기, 토큰 파싱, `setSession`, 프로필 생성
- `mobile/app/(tabs)/profile/index.tsx` — Google 로그인 버튼 및 `signInWithGoogle()` 호출
