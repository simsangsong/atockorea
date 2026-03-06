# Google Maps 로드 오류 해결 가이드

## 🔴 "Google 지도를 제대로 로드할 수 없습니다" 오류

이 오류는 Google Maps API 키 설정 문제로 발생합니다.

**지도는 보이는데 주소 검색/핀 꽂기가 안 되고** 위 메시지가 뜨거나, 콘솔에 `You're calling a legacy API, which is not enabled` 가 보이면 → 아래 **"You're calling a legacy API"** 항목으로 이동하세요.

## ✅ 해결 방법

### 1. API 키 확인

`.env.local` 파일이 프로젝트 루트에 있는지 확인하고, 다음 내용이 있는지 확인하세요:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=여기에_실제_API_키_입력
```

**중요**: 
- 파일명은 정확히 `.env.local`이어야 합니다 (앞에 점 포함)
- `NEXT_PUBLIC_` 접두사가 반드시 있어야 합니다
- API 키 값 앞뒤에 따옴표나 공백이 없어야 합니다

### 2. Google Cloud Console에서 API 키 확인

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com/
   - 프로젝트 선택

2. **API 키 확인**
   - 좌측 메뉴: **APIs & Services** → **Credentials**
   - API 키 목록에서 사용 중인 키 확인

3. **필수 API 활성화 확인**
   - 좌측 메뉴: **APIs & Services** → **Library**
   - 다음 API들이 **ENABLED** 상태인지 확인:
     - ✅ **Maps JavaScript API**
     - ✅ **Places API**
     - ✅ **Geocoding API** (선택사항)

### 3. API 키 제한 설정 확인

1. **API 키 편집**
   - Credentials 페이지에서 API 키 클릭

2. **Application restrictions (애플리케이션 제한)**
   - **HTTP referrers (web sites)** 선택
   - 다음 URL 추가:
     ```
     http://localhost:3000/*
     http://localhost:3000
     https://*.vercel.app/*
     https://atockorea.com/*
     ```
   - ⚠️ **주의**: `http://localhost:3000/*`와 `http://localhost:3000` 둘 다 추가

3. **API restrictions (API 제한)**
   - **Restrict key** 선택
   - 다음 API만 허용:
     - Maps JavaScript API
     - Places API
     - Geocoding API (사용하는 경우)

### 4. 결제 계정 확인

Google Maps API는 **무료 크레딧**을 제공하지만, 결제 계정이 설정되어 있어야 합니다.

1. **결제 계정 확인**
   - 좌측 메뉴: **Billing**
   - 결제 계정이 연결되어 있는지 확인
   - 없으면 "Link a billing account" 클릭하여 설정

2. **무료 크레딧**
   - 매월 $200 무료 크레딧 제공
   - 대부분의 소규모 프로젝트에는 충분합니다

### 5. 개발 서버 재시작

환경 변수를 변경한 후에는 **반드시 개발 서버를 재시작**해야 합니다:

```bash
# 서버 중지 (Ctrl+C)
# 그 다음 다시 시작
npm run dev
```

### 6. 브라우저 캐시 클리어

1. 브라우저 개발자 도구 열기 (F12)
2. Network 탭에서 "Disable cache" 체크
3. 페이지 새로고침 (Ctrl+Shift+R 또는 Cmd+Shift+R)

## 🔍 문제 진단

### API 키가 설정되지 않은 경우

브라우저 콘솔에 다음과 같은 오류가 나타납니다:
```
Google Maps API error: MissingKeyMapError
```

**해결**: `.env.local` 파일에 API 키 추가 후 서버 재시작

### API 키가 잘못된 경우

브라우저 콘솔에 다음과 같은 오류가 나타납니다:
```
Google Maps API error: RefererNotAllowedMapError
```

**해결**: Google Cloud Console에서 API 키의 HTTP referrers에 현재 도메인 추가

### 필요한 API가 활성화되지 않은 경우

브라우저 콘솔에 다음과 같은 오류가 나타납니다:
```
Google Maps API error: ApiNotActivatedMapError
```

**해결**: Google Cloud Console에서 Maps JavaScript API와 Places API 활성화

### "You're calling a legacy API, which is not enabled" / 주소 검색·핀 꽂기 실패

지도는 보이지만 **주소 검색창에 입력하거나 지도에서 위치를 선택할 때** "Google 지도를 제대로 로드할 수 없습니다" 또는 콘솔에 다음 오류가 나오는 경우:

```
You're calling a legacy API, which is not enabled for your project.
```

**원인**: 해당 프로젝트에서 **Places API**(주소 자동완성·장소 검색용)가 사용 설정되지 않았습니다.

**해결**:

1. **Google Cloud Console** 접속  
   - https://console.cloud.google.com/  
   - 픽업장소/지도에 사용 중인 **같은 프로젝트** 선택

2. **API 라이브러리** 이동  
   - 왼쪽 메뉴: **APIs & Services** → **Library**

3. **Places API** 사용 설정  
   - 검색창에 **"Places API"** 입력  
   - **Places API** (이름만 "Places API", "New"가 아닌 것) 선택  
   - **Enable** 클릭

4. **Maps JavaScript API** 확인  
   - 라이브러리에서 **"Maps JavaScript API"** 검색 후 선택  
   - 이미 사용 설정되어 있지 않으면 **Enable** 클릭

5. **API 키 제한**에 포함되었는지 확인  
   - **APIs & Services** → **Credentials** → 사용 중인 API 키 편집  
   - **API restrictions**에서 **Restrict key** 사용 시  
     - **Maps JavaScript API**, **Places API**, **Geocoding API** 가 목록에 포함되어 있는지 확인

6. 브라우저에서 **캐시 삭제 후 새로고침** (Ctrl+Shift+R) 후 픽업장소 관리 화면에서 다시 주소 검색·핀 선택을 시도하세요.

---

### Places API (New) 사용 시 (권장)

이 프로젝트는 **Places API (New)** 와 **PlaceAutocompleteElement** 를 사용하도록 되어 있습니다.

1. **Google Cloud Console** → **APIs & Services** → **Library**
2. **"Places API (New)"** 검색 후 **Enable** 클릭
3. 기존 **Maps JavaScript API** 도 사용 설정되어 있어야 합니다
4. 스크립트는 `version: 'weekly'` 로 로드되므로 새 Place Autocomplete 위젯을 사용할 수 있습니다
5. API 키 제한에서 **Places API (New)** 또는 **Places API** 가 허용 목록에 포함되어 있는지 확인하세요

### 결제 계정이 없는 경우

브라우저 콘솔에 다음과 같은 오류가 나타납니다:
```
Google Maps API error: BillingNotEnabledMapError
```

**해결**: Google Cloud Console에서 결제 계정 연결

## 📝 빠른 체크리스트

- [ ] `.env.local` 파일이 프로젝트 루트에 있음
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 환경 변수가 설정됨
- [ ] API 키 값이 올바름 (AIza...로 시작)
- [ ] Maps JavaScript API 활성화됨
- [ ] Places API 활성화됨
- [ ] API 키의 HTTP referrers에 `http://localhost:3000/*` 추가됨
- [ ] 결제 계정이 연결됨
- [ ] 개발 서버를 재시작함
- [ ] 브라우저 캐시를 클리어함

## 🆘 여전히 문제가 있나요?

1. **브라우저 콘솔 확인**
   - F12 → Console 탭
   - 빨간색 오류 메시지 확인
   - 오류 메시지를 복사하여 검색

2. **Google Cloud Console 확인**
   - APIs & Services → Dashboard
   - API 사용량 확인
   - 오류 로그 확인

3. **API 키 테스트**
   - 브라우저에서 직접 테스트:
   ```
   https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places
   ```
   - 오류 메시지가 나타나면 API 키 문제

## 📚 참고 문서

- [Google Maps API 문서](https://developers.google.com/maps/documentation/javascript)
- [API 키 설정 가이드](docs/GOOGLE_MAPS_API_SETUP.md)
- [빠른 시작 가이드](docs/GOOGLE_MAPS_QUICK_START.md)









