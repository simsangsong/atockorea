# 안드로이드 앱 개발 가이드

## 🎯 개요

현재 Next.js 웹사이트를 기반으로 안드로이드 앱을 만드는 방법입니다.

## 📋 접근 방법 비교

### 1. Capacitor (추천 ⭐)

**장점:**
- ✅ 기존 Next.js 코드를 거의 그대로 재사용 가능
- ✅ 빠른 개발 속도
- ✅ 네이티브 기능 접근 가능 (카메라, 푸시 알림 등)
- ✅ 하나의 코드베이스로 웹과 앱 모두 지원

**단점:**
- ⚠️ 웹뷰 기반이라 순수 네이티브보다는 성능이 약간 낮음

### 2. React Native

**장점:**
- ✅ 완전한 네이티브 성능
- ✅ 풍부한 네이티브 모듈

**단점:**
- ❌ 코드를 거의 새로 작성해야 함
- ❌ 개발 시간이 많이 소요

### 3. PWA (Progressive Web App)

**장점:**
- ✅ 가장 빠른 구현
- ✅ 별도 앱 스토어 승인 불필요

**단점:**
- ❌ 네이티브 기능 제한
- ❌ 앱 스토어 배포 불가

---

## 🚀 Capacitor를 사용한 안드로이드 앱 개발

### 전제 조건

1. **Node.js** (이미 설치됨)
2. **Java JDK 11+** 설치 필요
3. **Android Studio** 설치 필요
4. **Android SDK** 설정 필요

### 1단계: Capacitor 설치

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 2단계: Capacitor 초기화

```bash
npx cap init
```

질문에 답하기:
- **App name:** AtoC Korea
- **App ID:** com.atockorea.app
- **Web dir:** out (Next.js export용) 또는 .next (개발용)

### 3단계: Next.js 설정 (Static Export)

`next.config.js`에 추가:

```javascript
const nextConfig = {
  output: 'export', // Static export 활성화
  images: {
    unoptimized: true, // Capacitor에서 필요
  },
  // ... 기존 설정
}
```

### 4단계: 빌드 및 Android 프로젝트 생성

```bash
# Next.js 빌드
npm run build

# Android 프로젝트 추가
npx cap add android

# 빌드 파일을 Android 프로젝트에 복사
npx cap copy

# Android Studio에서 열기
npx cap open android
```

### 5단계: Android Studio에서 빌드

1. Android Studio가 열림
2. **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. APK 파일 생성 완료!

---

## 📱 네이티브 기능 통합

### 필요한 Capacitor 플러그인

```bash
# 카메라
npm install @capacitor/camera

# 푸시 알림
npm install @capacitor/push-notifications

# 위치 정보
npm install @capacitor/geolocation

# 파일 시스템
npm install @capacitor/filesystem

# 스토리지
npm install @capacitor/preferences

# 상태바
npm install @capacitor/status-bar

# 네트워크 상태
npm install @capacitor/network
```

### 예시: 카메라 사용

```typescript
import { Camera, CameraResultType } from '@capacitor/camera';

const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri
  });
  
  // image.webPath를 사용하여 이미지 표시
};
```

### 예시: 푸시 알림

```typescript
import { PushNotifications } from '@capacitor/push-notifications';

// 푸시 알림 등록
PushNotifications.register();

// 알림 수신 이벤트
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('Push notification received: ', notification);
});
```

---

## 🔧 API 연동

### Supabase

기존 Supabase 설정은 그대로 사용 가능합니다.

```typescript
import { supabase } from '@/lib/supabase';

// 앱에서도 동일하게 사용
const { data, error } = await supabase
  .from('tours')
  .select('*');
```

### Google Maps

Capacitor에서는 Google Maps JavaScript API 대신 네이티브 Google Maps를 사용하는 것이 좋습니다.

플러그인:
```bash
npm install @capacitor-community/google-maps
```

---

## 📦 빌드 및 배포

### 개발용 APK 빌드

```bash
# 1. Next.js 빌드
npm run build

# 2. Capacitor에 복사
npx cap copy

# 3. Android Studio에서 빌드
npx cap open android
```

### 릴리스용 AAB 빌드 (Play Store 배포용)

Android Studio에서:
1. **Build** → **Generate Signed Bundle / APK**
2. **Android App Bundle** 선택
3. 키스토어 생성/선택
4. AAB 파일 생성

---

## ⚙️ 환경 변수 설정

### Capacitor 설정 파일

`capacitor.config.ts`:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.atockorea.app',
  appName: 'AtoC Korea',
  webDir: 'out',
  server: {
    // 개발 중에만 사용 (프로덕션에서는 제거)
    // url: 'http://localhost:3000',
    // cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
    },
  },
};

export default config;
```

### 환경 변수

`.env.production` 파일 생성:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://atockorea.com
```

---
## 🎨 모바일 최적화

### 터치 친화적 UI

- 버튼 최소 크기: 44x44px
- 터치 간격 충분히 확보
- 스와이프 제스처 지원

### 성능 최적화

- 이미지 최적화 (WebP 사용)
- 코드 스플리팅
- 지연 로딩 (Lazy Loading)

### 반응형 디자인

Tailwind CSS의 반응형 클래스 활용:
```tsx
<div className="px-4 md:px-8">
  {/* 모바일: px-4, 데스크톱: px-8 */}
</div>
```

---

## 📱 필수 네이티브 기능

### 1. 스플래시 스크린

```bash
npm install @capacitor/splash-screen
```

### 2. 상태바

```bash
npm install @capacitor/status-bar
```

### 3. 뒤로가기 버튼 처리

```typescript
import { App } from '@capacitor/app';

App.addListener('backButton', ({ canGoBack }) => {
  if (canGoBack) {
    window.history.back();
  } else {
    App.exitApp();
  }
});
```

---

## 🔐 보안 고려사항

### API 키 보안

- **절대 하드코딩 금지**
- 환경 변수 사용
- Proguard/R8로 코드 난독화

### Android 권한

`android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

---

## 📋 체크리스트

### 개발 준비
- [ ] Java JDK 11+ 설치
- [ ] Android Studio 설치
- [ ] Android SDK 설정
- [ ] Capacitor 설치

### 프로젝트 설정
- [ ] `next.config.js`에 `output: 'export'` 추가
- [ ] Capacitor 초기화
- [ ] Android 플랫폼 추가
- [ ] 환경 변수 설정

### 네이티브 기능
- [ ] 필요한 플러그인 설치
- [ ] 권한 설정
- [ ] 네이티브 기능 테스트

### 빌드 및 배포
- [ ] 개발용 APK 빌드 테스트
- [ ] 릴리스용 AAB 빌드
- [ ] Google Play Console 설정
- [ ] 앱 스토어 제출

---

## 🆘 문제 해결

### 문제: 빌드 오류

**해결:**
```bash
# 캐시 정리
rm -rf .next
rm -rf android
npm run build
npx cap add android
npx cap copy
```

### 문제: API 호출 실패

**해결:**
- `capacitor.config.ts`에서 `server.url` 확인
- CORS 설정 확인
- 네트워크 권한 확인

### 문제: 이미지가 표시되지 않음

**해결:**
- `next.config.js`에서 `images.unoptimized: true` 설정
- 이미지 경로 확인 (절대 경로 사용)

---

## 📚 참고 자료

- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Next.js Static Export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
- [Android 개발자 가이드](https://developer.android.com/guide)

---

## 🎯 다음 단계

1. Capacitor 설치 및 초기화
2. Next.js Static Export 설정
3. Android 프로젝트 생성
4. 기본 빌드 테스트
5. 네이티브 기능 통합
6. Play Store 제출 준비













