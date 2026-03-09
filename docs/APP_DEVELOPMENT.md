# AtoC Korea 앱 개발 가이드

웹사이트 구성을 마친 후 **Android 앱** 개발을 시작하기 위한 메인 가이드입니다.

---

## 현재 구성

- **Capacitor**로 **Android 앱** 구성 (웹뷰 기반)
- 앱은 **운영 사이트(https://www.atockorea.com)** 를 로드하는 방식 → 웹 수정 시 **앱 재빌드 없이** 반영
- 설정: `capacitor.config.ts` (appId: `com.atockorea.app`, server.url 사용)

---

## 앱 개발 시작하기

### 1. 필수 환경

- **Node.js** (이미 사용 중)
- **Java JDK 11+**  
  - Windows: [Adoptium](https://adoptium.net/) 또는 `choco install openjdk11`
- **Android Studio**  
  - [developer.android.com/studio](https://developer.android.com/studio) 에서 설치 후 Android SDK 설치

### 2. Android 프로젝트 추가 (최초 1회)

```bash
# 프로젝트 루트에서
npm install

# Live URL 모드에서는 out 폴더가 비어 있어도 됨 (없으면 생성)
# PowerShell: if (-not (Test-Path out)) { New-Item -ItemType Directory -Path out }

# Android 플랫폼 추가 (android/ 폴더 생성)
npm run android:add
# 또는: npx cap add android

# Capacitor 설정을 Android 쪽에 반영
npm run android:sync
# 또는: npx cap sync android
```

### 3. Android Studio에서 실행

```bash
npm run android:open
# 또는: npx cap open android
```

Android Studio에서:

1. 기기 또는 에뮬레이터 선택
2. **Run** (▶) 버튼으로 앱 실행

앱이 **운영 사이트**를 웹뷰로 띄우면 정상 동작입니다.

### 4. 로컬/스테이징 URL로 테스트

앱이 **다른 URL**(로컬, 스테이징)을 보게 하려면:

```bash
# 예: 로컬 개발 서버
set CAPACITOR_SERVER_URL=http://10.0.2.2:3000
npx cap sync android
```

- 에뮬레이터에서 PC 로컬: 보통 `http://10.0.2.2:3000`
- 실제 기기: PC IP 사용 (예: `http://192.168.0.10:3000`)

---

## 자주 쓰는 명령어

| 목적 | 명령어 |
|------|--------|
| Android 플랫폼 추가 | `npm run android:add` |
| 설정/플러그인 반영 | `npm run android:sync` |
| Android Studio 열기 | `npm run android:open` |

---

## 다음 단계 문서

- **빠른 설정**: [ANDROID_APP_QUICKSTART.md](./ANDROID_APP_QUICKSTART.md)
- **상세 설정·Static Export**: [ANDROID_APP_SETUP.md](./ANDROID_APP_SETUP.md)
- **실시간 동기화·Play Store**: [ANDROID_APP_LIVE_SYNC_AND_PLAYSTORE.md](./ANDROID_APP_LIVE_SYNC_AND_PLAYSTORE.md)
- **앱에서 쓰는 API**: [MOBILE_APP_API_SETUP.md](./MOBILE_APP_API_SETUP.md)

---

## 네이티브 앱 (Expo, 레이아웃 동일 신규 앱)

웹뷰가 아닌 **전용 네이티브 앱**으로 같은 레이아웃을 쓰려면 **Expo 앱**(`mobile/`)을 사용합니다.

- **위치**: `mobile/` (Expo + React Native)
- **실행**: `cd mobile && npm start` → Android/iOS/Web
- **설계**: [NATIVE_APP_PLAN.md](./NATIVE_APP_PLAN.md) 참고

홈 화면은 웹과 동일한 순서(히어로 → 결제 안내 → 트러스트바 → 목적지 → 인기 투어 → 전체 투어)로 구성되어 있으며, 기존 웹 API(`https://www.atockorea.com/api/...`)를 그대로 사용합니다.

---

## 참고: React Native 스크립트

`scripts/setup-react-native.sh`와 `mobile:setup` 스크립트는 **별도 React Native 프로젝트** 초기화용입니다.  
**Capacitor 웹뷰** 앱은 위 Android 절차를, **레이아웃 동일 네이티브 앱**은 `mobile/`(Expo)를 사용하면 됩니다.
