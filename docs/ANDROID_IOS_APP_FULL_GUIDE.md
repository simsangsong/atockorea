# 안드로이드·애플(iOS) 앱 제작 전체 가이드 (0 → X)

AtoC Korea 프로젝트 기준으로 **안드로이드 앱**과 **애플(iOS) 앱**을 처음부터 스토어 배포까지 만드는 전체 단계를 정리한 문서입니다.

---

## 목차

1. [접근 방식 선택 (Capacitor vs Expo)](#1-접근-방식-선택)
2. [Step 0: 사전 준비 (계정·도구)](#2-step-0-사전-준비)
3. [안드로이드 앱 (0 → 스토어)](#3-안드로이드-앱-전체-단계)
4. [애플(iOS) 앱 (0 → 스토어)](#4-애플-ios-앱-전체-단계)
5. [요약 체크리스트](#5-요약-체크리스트)

---

## 1. 접근 방식 선택

이 프로젝트에는 **두 가지 앱 제작 경로**가 있습니다.

| 구분 | Capacitor (웹뷰) | Expo (네이티브) |
|------|------------------|------------------|
| **위치** | 프로젝트 루트 (Next.js + `android/`) | `mobile/` 폴더 |
| **동작** | 웹사이트를 앱 안에서 웹뷰로 띄움 | React Native로 화면을 직접 그림 |
| **장점** | 웹 수정만으로 앱에도 반영, 개발 빠름 | 네이티브 성능·UX, 오프라인 대응 용이 |
| **단점** | 웹뷰 성능/제약 | 화면·로직을 앱용으로 따로 개발 |
| **Android** | ✅ 지원 | ✅ 지원 |
| **iOS** | ✅ 지원 (설정 추가 필요) | ✅ 지원 (Mac 필요) |

- **웹과 완전 동일하게, 빠르게 앱만 띄우고 싶다** → **Capacitor**
- **앱 전용 UI·성능을 중시한다** → **Expo (`mobile/`)** ⭐

**Expo로 진행할 때 빠른 시작:**
```bash
cd mobile
npm install
npm start
```
- 터미널에서 **a** → Android 에뮬레이터/기기, **i** → iOS 시뮬레이터 (Mac), **w** → 웹
- 또는 `npm run android` / `npm run ios` / `npm run web`

아래 단계는 **Capacitor**와 **Expo** 둘 다를 포함해, 공통(Step 0) → Android → iOS 순으로 설명합니다.

---

## 2. Step 0: 사전 준비

### 2.1 개발자 계정 (스토어 배포 시 필수)

| 스토어 | 계정 | 비용 | 가입 |
|--------|------|------|------|
| **Google Play** | Google Play Console | 1회 $25 | [play.google.com/console](https://play.google.com/console) |
| **Apple App Store** | Apple Developer Program | 연 $99 (약 13만 원) | [developer.apple.com](https://developer.apple.com/programs/) |

- 테스트용 APK/IPA만 만들 때는 **계정 없이** 로컬 빌드 가능.
- **실기기 테스트·스토어 배포**를 하려면 위 계정이 필요합니다.

### 2.2 공통 도구

- **Node.js** (v18 이상 권장) — 이미 사용 중이면 생략
- **Git** — 코드 관리
- **에디터** — VS Code / Cursor 등

### 2.3 안드로이드 전용 (Windows / Mac 공통)

| 도구 | 용도 | 설치 |
|------|------|------|
| **Java JDK 11+** | Android 빌드 | **Windows**: `winget install EclipseAdoptium.Temurin.17.JDK` 또는 [Adoptium](https://adoptium.net/) / `choco install openjdk11` (Chocolatey) |
| **Android Studio** | SDK·에뮬레이터·APK/AAB 빌드 | [developer.android.com/studio](https://developer.android.com/studio) |

- Android Studio 설치 후 **Android SDK** 설치 (처음 실행 시 안내).
- **환경 변수** (권장): `ANDROID_HOME` = SDK 경로 (예: `C:\Users\사용자명\AppData\Local\Android\Sdk`). Expo/React Native가 에뮬레이터·빌드를 찾을 때 사용.
- **에뮬레이터**: Android Studio → **Device Manager** (우측 상단 또는 Tools 메뉴) → **Create Device** → 기기 선택 후 시스템 이미지 다운로드 → AVD 생성. 실기기 USB 연결 시 에뮬레이터 없이 실행 가능.

### 2.4 iOS 전용 (반드시 Mac 필요)

| 도구 | 용도 | 설치 |
|------|------|------|
| **macOS** | Xcode·iOS 시뮬레이터·실기기 빌드 | — |
| **Xcode** | iOS 빌드·서명·시뮬레이터 | Mac App Store에서 "Xcode" 검색 후 설치 |
| **Xcode Command Line Tools** | 터미널에서 빌드 | `xcode-select --install` |
| **CocoaPods** (Expo/네이티브 시) | iOS 네이티브 의존성 | `sudo gem install cocoapods` |

- **Windows만 있는 경우**: iOS 앱 빌드·제출은 **Mac이 필요**합니다. (클라우드 Mac 서비스 예: MacStadium, MacinCloud, 또는 Expo EAS의 원격 빌드 활용 가능)

---

## 3. 안드로이드 앱 전체 단계

### 경로 A: Capacitor (웹뷰 앱)

이미 프로젝트에 Capacitor + Android가 붙어 있다고 가정합니다.

| 단계 | 내용 | 명령/작업 |
|------|------|-----------|
| **0** | 사전 준비 | 2장 대로 JDK, Android Studio 설치 |
| **1** | 의존성 설치 | `npm install` (프로젝트 루트) |
| **2** | Android 플랫폼 추가 (최초 1회) | `npm run android:add` 또는 `npx cap add android` |
| **3** | 설정 동기화 | `npm run android:sync` 또는 `npx cap sync android` |
| **4** | Android Studio에서 열기 | `npm run android:open` 또는 `npx cap open android` |
| **5** | 에뮬레이터/실기기에서 실행 | Android Studio에서 Run (▶) |
| **6** | APK 빌드 (테스트용) | Build → Build Bundle(s) / APK(s) → Build APK(s) |
| **7** | 스토어용 AAB 빌드 | Build → Build Bundle(s) / APK(s) → Build App Bundle(s) |
| **8** | Play Console 업로드·출시 | [Play Console](https://play.google.com/console) → 앱 생성 → AAB 업로드 → 스토어 정보·정책 작성 후 출시 |

- **Live URL 모드**: 앱이 `https://www.atockorea.com` 을 로드하므로, 웹만 수정해도 앱에는 재빌드 없이 반영됩니다.
- 상세: [ANDROID_APP_QUICKSTART.md](./ANDROID_APP_QUICKSTART.md), [APP_DEVELOPMENT.md](./APP_DEVELOPMENT.md), [ANDROID_APP_LIVE_SYNC_AND_PLAYSTORE.md](./ANDROID_APP_LIVE_SYNC_AND_PLAYSTORE.md)

### 경로 B: Expo (네이티브 앱, `mobile/`)

| 단계 | 내용 | 명령/작업 |
|------|------|-----------|
| **0** | 사전 준비 | 2장 대로 JDK, Android Studio 설치 |
| **1** | 모바일 앱 의존성 설치 | `cd mobile && npm install` |
| **2** | 개발 서버 실행 | `npm start` |
| **3** | Android 실행 | 터미널에서 `a` 키 또는 `npm run android` (에뮬레이터/연결된 기기 필요) |
| **4** | 로컬 APK 빌드 (Expo 개발 빌드) | `npx expo run:android` (필요 시 `npx expo prebuild` 먼저) |
| **5** | 스토어용 빌드 (EAS 사용 시) | [EAS Build](https://docs.expo.dev/build/introduction/) 설정 후 `eas build --platform android --profile production` |
| **6** | Play Console 업로드·출시 | AAB 업로드 후 스토어 정보·정책 작성 후 출시 |

- API는 `EXPO_PUBLIC_APP_URL`(기본 `https://www.atockorea.com`) 사용.
- 설계: [NATIVE_APP_PLAN.md](./NATIVE_APP_PLAN.md)

---

## 4. 애플(iOS) 앱 전체 단계

**전제: Mac + Xcode 필요.** Windows만 있으면 로컬 iOS 빌드는 불가하며, Expo EAS 등 원격 빌드 서비스를 쓸 수 있습니다.

### 경로 A: Capacitor로 iOS 추가

| 단계 | 내용 | 명령/작업 |
|------|------|-----------|
| **0** | 사전 준비 | Mac, Xcode, CocoaPods (필요 시) |
| **1** | iOS 플랫폼 추가 | `npx cap add ios` |
| **2** | 동기화 | `npx cap sync ios` |
| **3** | Xcode에서 열기 | `npx cap open ios` |
| **4** | 시뮬레이터에서 실행 | Xcode에서 시뮬레이터 선택 후 Run (▶) |
| **5** | 실기기 테스트 | Apple ID로 서명 후 기기 선택해 실행 |
| **6** | Archive·업로드 | Xcode: Product → Archive → Distribute App → App Store Connect |
| **7** | App Store Connect·제출 | [App Store Connect](https://appstoreconnect.apple.com)에서 앱 생성, 빌드 선택, 스토어 정보 입력 후 심사 제출 |

- 최초 1회: Xcode에서 **Team(Signing)** 설정 (Apple Developer 계정 연동).
- Capcitor iOS 설정은 `capacitor.config.ts`에서 `server.url` 등 웹 주소 유지.

### 경로 B: Expo로 iOS 빌드

| 단계 | 내용 | 명령/작업 |
|------|------|-----------|
| **0** | 사전 준비 | Mac + Xcode (로컬 빌드 시) 또는 Expo 계정 (EAS 원격 빌드 시) |
| **1** | 의존성 | `cd mobile && npm install` |
| **2** | 개발 서버 | `npm start` |
| **3** | iOS 시뮬레이터 실행 | 터미널에서 `i` 키 또는 `npm run ios` (Mac 필요) |
| **4** | 로컬 빌드 (Mac) | `npx expo run:ios` (필요 시 `npx expo prebuild` 먼저) |
| **5** | 원격 빌드 (Windows에서도 가능) | [EAS Build](https://docs.expo.dev/build/introduction/) 설정 후 `eas build --platform ios --profile production` |
| **6** | App Store Connect 제출 | EAS Submit 또는 수동으로 IPA 업로드 후 심사 제출 |

- **Apple Developer Program** 가입 후 **App Store Connect**에서 앱을 만들고, **Bundle ID**를 Expo `app.json`의 `expo.ios.bundleIdentifier`와 맞춥니다.

---

## 5. 요약 체크리스트

### 안드로이드 (공통)

- [ ] JDK 11+ 설치
- [ ] Android Studio + Android SDK 설치
- [ ] Capacitor 또는 Expo 중 하나 선택 후 해당 경로대로 실행
- [ ] 에뮬레이터 또는 실기기에서 앱 실행 확인
- [ ] (스토어) Google Play Console 가입 ($25)
- [ ] (스토어) AAB 빌드 후 업로드
- [ ] (스토어) 개인정보처리방침 URL, 콘텐츠 등급, 데이터 보안 양식 등 정책 충족

### iOS (공통)

- [ ] Mac 준비 (또는 EAS 등 원격 빌드 사용)
- [ ] Xcode 설치 (로컬 빌드 시)
- [ ] Apple Developer Program 가입 (연 $99)
- [ ] Capacitor면 `npx cap add ios` 후 Xcode에서 빌드, Expo면 `mobile/`에서 `npm run ios` 또는 EAS 빌드
- [ ] App Store Connect에서 앱 생성·Bundle ID 설정
- [ ] Archive 또는 EAS로 빌드 후 제출

### 스토어 공통

- [ ] 앱 이름·설명·스크린샷·아이콘 준비
- [ ] 개인정보처리방침 URL (웹에 공개된 페이지)
- [ ] (Google) 콘텐츠 등급, 데이터 보안
- [ ] (Apple) 앱 심사 가이드라인 준수

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [ANDROID_APP_QUICKSTART.md](./ANDROID_APP_QUICKSTART.md) | 안드로이드 5분 빠른 시작 (Capacitor) |
| [APP_DEVELOPMENT.md](./APP_DEVELOPMENT.md) | 앱 개발 메인 가이드 (Capacitor + Expo 소개) |
| [ANDROID_APP_SETUP.md](./ANDROID_APP_SETUP.md) | 안드로이드 상세 설정 (Capacitor) |
| [ANDROID_APP_LIVE_SYNC_AND_PLAYSTORE.md](./ANDROID_APP_LIVE_SYNC_AND_PLAYSTORE.md) | 웹 연동·Play 스토어 정책 |
| [NATIVE_APP_PLAN.md](./NATIVE_APP_PLAN.md) | Expo 네이티브 앱 설계 (`mobile/`) |

이 문서는 **0단계(준비) → 개발 → 빌드 → 스토어 배포**까지의 전체 흐름을 한 번에 보기 위한 요약입니다. 세부 작업은 위 개별 문서를 참고하면 됩니다.
