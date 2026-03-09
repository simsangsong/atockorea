# Expo로 AtoC Korea Android 앱 만들기 (제로부터)

AtoC Korea 사이트를 **Expo(React Native)** 로 Android 앱으로 만드는 순서입니다.  
Capacitor(웹뷰)가 아니라 **네이티브 앱** 경로입니다.

---

## 준비된 것 (이미 있음)

- ✅ **Android Studio** 설치
- ✅ **Android SDK** 설치 (`ANDROID_HOME` 설정됨)
- ✅ **mobile/** 폴더 — Expo 프로젝트 (Home, Tours, Cart, Profile 탭)
- ✅ **app.json** — 앱 이름 "AtoC Korea", slug "atockorea"

---

## 1단계: 의존성 설치 (맨 처음 할 일)

프로젝트 루트가 아니라 **mobile 폴더**에서 실행합니다.

```bash
cd mobile
npm install
```

한 번만 하면 됩니다. 새로 clone 했거나 `package.json`이 바뀌었을 때만 다시 실행.

---

## 2단계: 개발 서버 띄우기

```bash
cd mobile
npm start
```

- **Cursor/VS Code**: `npm start`를 **Cursor 하단 터미널**에서 실행하면, **그 터미널 탭**에 단축키 안내가 뜹니다. 그 터미널이 포커스된 상태에서 **`a`** 누르면 Android 실행. (QR 코드는 터미널에서 잘 안 보일 수 있어서, `a` 키로 실행하는 게 가장 확실함)
- **브라우저**: 설정에 따라 Expo가 **브라우저 탭**을 자동으로 열어 QR 코드·Dev Tools를 보여 주기도 합니다.

---

## 3단계: Android에서 실행

**에뮬레이터**를 먼저 켜거나 **실기기**를 USB로 연결한 뒤:

- 터미널에서 **`a`** 키 누르기  
  **또는**
- 다른 터미널에서:
  ```bash
  cd mobile
  npm run android
  ```

앱이 에뮬레이터/기기에서 실행되면 **여기까지가 “앱 만든다”의 첫 목표**입니다.

---

## 4단계: 로컬에서 APK 빌드 (테스트용)

실기기나 다른 사람에게 줄 **APK**를 만들 때:

```bash
cd mobile
npx expo run:android
```

필요하면 최초 1회 `npx expo prebuild` 후 다시 `npx expo run:android` 하면 됩니다.  
빌드된 APK는 `android/app/build/outputs/apk/` 등에 생성됩니다.

---

## 5단계: 스토어용 빌드 (나중에)

Google Play에 올릴 **AAB**는 **EAS Build** 사용을 권장합니다.

1. [expo.dev](https://expo.dev) 에서 계정 생성
2. 프로젝트에 로그인:
   ```bash
   cd mobile
   npx eas login
   npx eas build:configure
   ```
3. Android 프로덕션 빌드:
   ```bash
   npx eas build --platform android --profile production
   ```
4. 완료 후 다운로드한 AAB를 [Google Play Console](https://play.google.com/console)에 업로드

---

## 요약: “맨 처음 해야 할 일”만

| 순서 | 할 일 | 명령 |
|------|--------|------|
| 1 | mobile 폴더로 이동 | `cd mobile` |
| 2 | 의존성 설치 | `npm install` |
| 3 | 개발 서버 실행 | `npm start` |
| 4 | Android 실행 | 키보드 **a** 또는 `npm run android` |

에뮬레이터/기기가 켜져 있어야 4번이 동작합니다.

---

## 개발할 때 (지금 하실 일)

### 워크플로
1. **Expo 서버**는 켜 둔 상태로 두기 (`npm start` 또는 `npm run android` 실행 중인 터미널).
2. **Cursor**에서 `mobile/` 아래 파일 수정 후 **저장**.
3. 에뮬레이터/기기에서 **자동 새로고침**(Fast Refresh) 되거나, 안 되면 앱에서 개발자 메뉴 열고 **Reload**.
4. **에뮬레이터에서 개발자 메뉴 여는 법**: 기기 흔들기 또는 `Ctrl+M` (Windows 에뮬레이터) / `Cmd+D` (Mac).

### 수정할 파일 위치 (mobile/)
| 하고 싶은 것 | 수정할 파일 |
|--------------|--------------|
| **홈 화면** (히어로, 결제 안내, 트러스트바, 목적지, 투어 목록) | `app/(tabs)/index.tsx` |
| 홈 블록 UI (히어로·결제·트러스트바·카드 등) | `components/home/HeroSection.tsx`, `PaymentStrip.tsx`, `TrustBar.tsx`, `DestinationsCards.tsx`, `TourCard.tsx` |
| **탭** (Home / Tours / Cart / Profile) | `app/(tabs)/_layout.tsx` |
| **투어 목록** 탭 | `app/(tabs)/tours.tsx` |
| **투어 상세** (투어 하나 클릭 시) | `app/tour/[id].tsx` |
| **장바구니** 탭 | `app/(tabs)/cart.tsx` |
| **프로필** 탭 | `app/(tabs)/profile.tsx` |
| **API 주소** (백엔드 URL) | `api/client.ts` 또는 `.env`의 `EXPO_PUBLIC_APP_URL` |
| **테마/색상** | `constants/theme.ts`, `constants/Colors.ts` |

### 디버깅
- **개발자 메뉴** → **Open DevTools** → 브라우저에서 콘솔·네트워크 확인.
- **Toggle element inspector** → 화면에서 터치한 영역의 컴포넌트 확인.

---

## API / 환경

- 앱은 **웹과 같은 API**를 씁니다.
- Base URL은 `mobile/.env` 또는 `EXPO_PUBLIC_APP_URL`로 설정 (기본값: `https://www.atockorea.com`).
- `mobile/api/client.ts` 등에서 이 URL을 사용합니다.

---

## 관련 문서

| 문서 | 설명 |
|------|------|
| [NATIVE_APP_PLAN.md](./NATIVE_APP_PLAN.md) | 앱 화면 구성·API·웹과의 대응 |
| [ANDROID_IOS_APP_FULL_GUIDE.md](./ANDROID_IOS_APP_FULL_GUIDE.md) | Android/iOS 전체 단계 (Capacitor + Expo) |

---

정리: **Expo로 앱 만든다** → `cd mobile` → `npm install` → `npm start` → **a** 로 Android 실행이 “맨 처음 해야 할 일”입니다.
