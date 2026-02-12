# 안드로이드 앱 빠른 시작 가이드

## ⚡ 5분 안에 시작하기

### 1. 필수 프로그램 설치

#### Java JDK 설치
```bash
# Windows에서 Chocolatey 사용 시
choco install openjdk11

# 또는 공식 사이트에서 다운로드
# https://adoptium.net/
```

#### Android Studio 설치
- https://developer.android.com/studio 에서 다운로드
- 설치 후 Android SDK 설치

### 2. Capacitor 설치

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

### 3. Next.js 설정 변경

`next.config.js` 수정:

```javascript
const nextConfig = {
  output: 'export', // 이 줄 추가
  images: {
    unoptimized: true, // 이 줄 추가
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // ... 나머지 설정
  },
  // ... 기존 설정
}
```

### 4. Capacitor 초기화

```bash
npx cap init "AtoC Korea" "com.atockorea.app" --web-dir=out
```

### 5. Android 플랫폼 추가

```bash
# Next.js 빌드 먼저
npm run build

# Android 추가
npx cap add android

# 파일 복사
npx cap copy
```

### 6. Android Studio에서 열기

```bash
npx cap open android
```

### 7. 첫 번째 APK 빌드

Android Studio에서:
1. 상단 메뉴: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
2. 빌드 완료 후 APK 파일 위치 확인
3. 안드로이드 기기에 설치하여 테스트

---

## 🎉 완료!

이제 기본적인 안드로이드 앱이 생성되었습니다.

다음 단계는 `docs/ANDROID_APP_SETUP.md`를 참고하세요.













