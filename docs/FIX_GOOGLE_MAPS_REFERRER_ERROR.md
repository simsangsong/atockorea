# Google Maps Referrer 오류 해결 방법

## 🔴 문제

```
Google Maps JavaScript API error: RefererNotAllowedMapError
Your site URL to be authorized: https://www.atockorea.com/tour/...
```

**원인:** Google Cloud Console의 API Key HTTP referrer 제한에 `www.atockorea.com`이 포함되어 있지 않음

## ✅ 해결 방법

### 1. Google Cloud Console 접속

1. https://console.cloud.google.com/ 접속
2. 프로젝트 선택
3. **APIs & Services** → **Credentials** 이동

### 2. API Key 편집

1. Google Maps API Key 찾기
2. API Key 이름 클릭하여 편집 페이지 열기

### 3. Application Restrictions 업데이트

**"Application restrictions" 섹션에서:**

1. **"HTTP referrers (web sites)" 선택** (웹사이트)

2. **"Website restrictions"에 다음 URL 추가:**

   ```
   http://localhost:3000/*
   https://atockorea.com/*
   https://www.atockorea.com/*
   https://*.vercel.app/*
   ```

   ⚠️ **중요:** `www.atockorea.com`과 `atockorea.com` **둘 다** 추가해야 함!

3. **"Save" 버튼 클릭**

### 4. 변경 사항 적용 대기

- 변경 사항은 보통 **5-10분 내에** 적용됩니다
- 브라우저 캐시를 클리어하거나 페이지를 새로고침할 수도 있습니다

## 📋 전체 URL 패턴 목록

```
http://localhost:3000/*
https://atockorea.com/*
https://www.atockorea.com/*
https://*.vercel.app/*
```

## 🔍 확인 방법

1. 설정 저장 후 5-10분 대기
2. 프로덕션 사이트 방문: https://www.atockorea.com
3. 투어 상세 페이지 접속
4. 브라우저 콘솔(F12)에서 에러가 사라졌는지 확인

## ⚠️ 주의사항

- `www.`가 있는 도메인과 없는 도메인은 **다르게 인식**됩니다
- 둘 다 추가하지 않으면 일부 페이지에서 에러가 발생할 수 있습니다
- 변경 사항은 즉시 적용되지 않을 수 있으므로 몇 분 기다려야 합니다

## 🎯 빠른 체크리스트

- [ ] Google Cloud Console 접속
- [ ] API Key 찾기 및 편집
- [ ] "HTTP referrers (web sites)" 선택
- [ ] `http://localhost:3000/*` 추가
- [ ] `https://atockorea.com/*` 추가
- [ ] `https://www.atockorea.com/*` 추가 ⚠️ (중요!)
- [ ] `https://*.vercel.app/*` 추가
- [ ] 저장
- [ ] 5-10분 대기
- [ ] 테스트

