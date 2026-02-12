# Google Maps API Referrer 오류 빠른 해결

## 🔴 오류

```
RefererNotAllowedMapError
Your site URL to be authorized: https://www.atockorea.com/tour/...
```

## ✅ 해결 방법 (2분 안에 완료)

### 1. Google Cloud Console 접속
https://console.cloud.google.com/apis/credentials

### 2. API Key 찾기
- Google Maps API Key 클릭하여 편집

### 3. Application Restrictions 수정

**"애플리케이션 제한사항" (Application Restrictions) 섹션:**

1. **"웹사이트" (HTTP referrers) 선택**

2. **"웹사이트 제한사항"에 다음 추가:**
   ```
   http://localhost:3000/*
   https://atockorea.com/*
   https://www.atockorea.com/*
   https://*.vercel.app/*
   ```

   ⚠️ **중요:** `www.atockorea.com`과 `atockorea.com` **둘 다** 있어야 함!

3. **"저장" 클릭**

### 4. 적용 대기
- 5-10분 대기 후 페이지 새로고침

## 📝 체크리스트

- [ ] Google Cloud Console 접속
- [ ] API Key 편집
- [ ] "웹사이트" 선택
- [ ] 4개 URL 모두 추가 확인
- [ ] 저장
- [ ] 5-10분 대기

## 💡 팁

변경 후 바로 테스트하려면:
- 브라우저 캐시 클리어 (Ctrl+Shift+Delete)
- 또는 시크릿 모드에서 테스트






