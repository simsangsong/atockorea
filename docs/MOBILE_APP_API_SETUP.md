# 모바일 앱 API 설정 가이드

## 🔄 API 호출 방식

Capacitor 앱에서는 Next.js API 라우트가 앱 번들에 포함되지 않으므로, 프로덕션 서버의 API를 호출해야 합니다.

### 웹 vs 모바일

| 환경 | API URL | 설명 |
|------|---------|------|
| **웹 (개발)** | `/api/...` | Next.js API 라우트 사용 (상대 경로) |
| **웹 (프로덕션)** | `/api/...` | Next.js API 라우트 사용 (상대 경로) |
| **모바일 앱** | `https://atockorea.com/api/...` | 원격 서버의 API 호출 |

## 📝 API 클라이언트 사용

`lib/api-client.ts`를 사용하여 환경에 맞게 자동으로 API URL을 선택합니다.

### 예시: 투어 목록 가져오기

```typescript
import { apiClient } from '@/lib/api-client';

// 웹과 모바일 모두에서 동일하게 사용
const tours = await apiClient.get('/api/tours');
```

### 예시: 예약 생성

```typescript
import { apiClient } from '@/lib/api-client';

const booking = await apiClient.post('/api/bookings', {
  tour_id: '123',
  date: '2024-01-01',
  guests: 2,
});
```

## ⚙️ 환경 변수 설정

### `.env.local` (웹 개발용)

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 프로덕션 환경 (Vercel)

```env
NEXT_PUBLIC_APP_URL=https://atockorea.com
```

### 모바일 앱

모바일 앱은 `process.env.NEXT_PUBLIC_APP_URL`을 읽어서 API 호출에 사용합니다.

## 🔐 인증 처리

### Supabase 인증

Supabase는 클라이언트 사이드에서 직접 사용 가능합니다:

```typescript
import { supabase } from '@/lib/supabase';

// 모바일 앱에서도 동일하게 작동
const { data, error } = await supabase
  .from('tours')
  .select('*');
```

### API 인증

API 라우트가 세션 쿠키를 사용하는 경우, 모바일에서는 토큰 기반 인증으로 변경해야 할 수 있습니다.

## 📱 Capacitor 설정

### 개발 중 (로컬 서버 사용)

`capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  server: {
    url: 'http://localhost:3000',
    cleartext: true, // HTTP 허용 (개발용)
  },
};
```

### 프로덕션 (번들된 파일 사용)

`capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  server: {
    // server 설정 제거 → 번들된 파일 사용
  },
};
```

이 경우 API는 `NEXT_PUBLIC_APP_URL`로 호출됩니다.

## 🔄 API 마이그레이션 체크리스트

기존 코드를 모바일 앱에서도 작동하도록 변경:

- [ ] `fetch('/api/...')` → `apiClient.get('/api/...')` 또는 `apiClient.post('/api/...')`
- [ ] 환경 변수 `NEXT_PUBLIC_APP_URL` 설정 확인
- [ ] 인증 방식 확인 (Supabase 클라이언트 사용 권장)
- [ ] CORS 설정 확인 (필요한 경우)

## 🐛 문제 해결

### API 호출 실패

**문제:** 모바일 앱에서 API 호출이 실패함

**해결:**
1. `NEXT_PUBLIC_APP_URL` 환경 변수 확인
2. 네트워크 연결 확인
3. CORS 설정 확인
4. Android `AndroidManifest.xml`에 인터넷 권한 추가:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

### 인증 문제

**문제:** 모바일 앱에서 인증이 작동하지 않음

**해결:**
1. Supabase 클라이언트 사용 권장 (서버 API 대신)
2. 토큰 기반 인증 구현
3. Secure Storage 사용 (`@capacitor/preferences`)





