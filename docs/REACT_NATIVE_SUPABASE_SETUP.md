# React Native Supabase 설정 가이드

## 📋 Supabase React Native 통합

### 1. Supabase 클라이언트 설정

웹의 `lib/supabase.ts`를 React Native에 맞게 변환:

```typescript
// mobile/src/services/supabase/client.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // React Native에서는 false
  },
});
```

### 2. 필수 패키지 설치

```bash
npm install @supabase/supabase-js
npm install @react-native-async-storage/async-storage
npm install react-native-url-polyfill
```

### 3. App.tsx에서 초기화

```typescript
// App.tsx 맨 위에
import 'react-native-url-polyfill/auto';
import { supabase } from './src/services/supabase/client';
```

---

## 🔐 인증 구현

### 로그인

```typescript
// mobile/src/services/auth/authService.ts
import { supabase } from '../supabase/client';

export const authService = {
  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  async signUpWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  onAuthStateChange(callback: (session: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  },
};
```

### 소셜 로그인 (OAuth)

```typescript
// Google 로그인 예시
async signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'atockorea://auth/callback', // 딥링크 설정 필요
    },
  });
  
  if (error) throw error;
  return data;
}
```

---

## 📊 데이터베이스 쿼리

### 투어 목록 가져오기

```typescript
const loadTours = async () => {
  const { data, error } = await supabase
    .from('tours')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading tours:', error);
    return [];
  }
  
  return data;
};
```

### 실시간 구독

```typescript
useEffect(() => {
  const subscription = supabase
    .channel('tours')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tours',
      },
      (payload) => {
        console.log('Change received!', payload);
        // 데이터 업데이트
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

---

## 🔄 웹과 공유 가능한 코드

### 타입 정의 (공유 가능)

```typescript
// shared/types/tour.ts (또는 mobile/src/types/tour.ts)
export interface Tour {
  id: string;
  title: string;
  slug: string;
  city: 'Seoul' | 'Busan' | 'Jeju';
  price: number;
  image_url: string;
  description: string;
  // ... 기타 필드
}
```

### 유틸리티 함수 (공유 가능)

```typescript
// shared/utils/format.ts
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('ko-KR');
}
```

---

## 🎯 차이점 정리

| 항목 | Next.js (웹) | React Native |
|------|-------------|--------------|
| **스토리지** | localStorage | AsyncStorage |
| **세션 URL 감지** | `detectSessionInUrl: true` | `detectSessionInUrl: false` |
| **폴리필** | 불필요 | `react-native-url-polyfill` 필요 |
| **OAuth 리다이렉트** | 브라우저 리다이렉트 | 딥링크 설정 필요 |

---

## ✅ 체크리스트

- [ ] `@supabase/supabase-js` 설치
- [ ] `@react-native-async-storage/async-storage` 설치
- [ ] `react-native-url-polyfill` 설치
- [ ] Supabase 클라이언트 설정
- [ ] 인증 서비스 구현
- [ ] 환경 변수 설정













