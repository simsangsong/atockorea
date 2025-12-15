# React Native 안드로이드 앱 개발 가이드

## 🎯 개요

현재 Next.js 웹사이트를 기반으로 React Native로 안드로이드 앱을 개발하는 방법입니다.

## 📋 프로젝트 구조

### 옵션 1: Monorepo 구조 (추천)

```
atockorea/
├── web/                 # Next.js 웹 앱 (기존)
│   ├── app/
│   ├── components/
│   └── lib/
├── mobile/              # React Native 앱 (새로 생성)
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── navigation/
│   │   └── services/
│   └── android/
└── shared/              # 공유 코드
    ├── types/
    ├── api/
    └── utils/
```

### 옵션 2: 별도 프로젝트

별도의 `atockorea-mobile` 프로젝트를 생성하고 필요한 코드를 복사/공유

## 🚀 시작하기

### 1단계: React Native 프로젝트 생성

```bash
# 새로운 React Native 프로젝트 생성
npx react-native@latest init AtoCKoreaMobile --template react-native-template-typescript

# 또는 Expo 사용
npx create-expo-app AtoCKoreaMobile --template
```

### 2단계: 필수 패키지 설치

```bash
cd AtoCKoreaMobile

# 네비게이션
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# Supabase (기존 웹과 동일)
npm install @supabase/supabase-js

# 상태 관리 (선택)
npm install zustand
# 또는
npm install @reduxjs/toolkit react-redux

# UI 컴포넌트
npm install react-native-paper
# 또는
npm install react-native-elements

# 이미지 및 미디어
npm install react-native-image-picker

# 네트워크
npm install axios

# 유틸리티
npm install @react-native-async-storage/async-storage
```

### 3단계: 프로젝트 구조 생성

```
src/
├── screens/           # 화면 컴포넌트
│   ├── Home/
│   ├── Tours/
│   ├── TourDetail/
│   ├── Booking/
│   ├── Cart/
│   ├── Profile/
│   └── Auth/
├── components/        # 재사용 가능한 컴포넌트
│   ├── TourCard/
│   ├── Header/
│   └── Button/
├── navigation/        # 네비게이션 설정
│   ├── AppNavigator.tsx
│   └── AuthNavigator.tsx
├── services/          # API 및 서비스
│   ├── api/
│   ├── supabase/
│   └── auth/
├── hooks/             # 커스텀 훅
├── utils/             # 유틸리티 함수
├── types/             # TypeScript 타입
└── constants/         # 상수
```

---

## 🔄 기존 코드 재사용

### 1. Supabase 클라이언트

웹의 `lib/supabase.ts`를 React Native에 맞게 수정:

```typescript
// mobile/src/services/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 2. API 클라이언트

웹의 `lib/api-client.ts`를 React Native용으로:

```typescript
// mobile/src/services/api/client.ts
import axios from 'axios';

const API_BASE_URL = 'https://atockorea.com/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 인증 토큰 자동 추가
apiClient.interceptors.request.use(async (config) => {
  const session = await supabase.auth.getSession();
  if (session.data.session) {
    config.headers.Authorization = `Bearer ${session.data.session.access_token}`;
  }
  return config;
});
```

### 3. 타입 정의

웹의 타입을 그대로 사용하거나 공유:

```typescript
// mobile/src/types/tour.ts
export interface Tour {
  id: string;
  title: string;
  city: 'Seoul' | 'Busan' | 'Jeju';
  price: number;
  image_url: string;
  // ... 기타 필드
}
```

### 4. 비즈니스 로직

유틸리티 함수들은 대부분 재사용 가능:

```typescript
// mobile/src/utils/format.ts
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(price);
}
```

---

## 📱 주요 화면 구현

### 1. 홈 화면

```typescript
// mobile/src/screens/Home/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { supabase } from '@/services/supabase/client';
import TourCard from '@/components/TourCard';
import { Tour } from '@/types/tour';

export default function HomeScreen() {
  const [tours, setTours] = useState<Tour[]>([]);

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    const { data, error } = await supabase
      .from('tours')
      .select('*')
      .eq('is_active', true)
      .limit(10);
    
    if (data) setTours(data);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={tours}
        renderItem={({ item }) => <TourCard tour={item} />}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}
```

### 2. 투어 상세 화면

```typescript
// mobile/src/screens/TourDetail/TourDetailScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, Text, Image } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { supabase } from '@/services/supabase/client';
import { Tour } from '@/types/tour';

export default function TourDetailScreen() {
  const route = useRoute();
  const { tourId } = route.params;
  const [tour, setTour] = useState<Tour | null>(null);

  useEffect(() => {
    loadTour();
  }, [tourId]);

  const loadTour = async () => {
    const { data } = await supabase
      .from('tours')
      .select('*')
      .eq('id', tourId)
      .single();
    
    if (data) setTour(data);
  };

  if (!tour) return <Text>Loading...</Text>;

  return (
    <ScrollView>
      <Image source={{ uri: tour.image_url }} style={styles.image} />
      <Text style={styles.title}>{tour.title}</Text>
      <Text style={styles.price}>{formatPrice(tour.price)}</Text>
      {/* 기타 상세 정보 */}
    </ScrollView>
  );
}
```

---

## 🗺️ 네비게이션 설정

```typescript
// mobile/src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '@/screens/Home/HomeScreen';
import TourDetailScreen from '@/screens/TourDetail/TourDetailScreen';
import ProfileScreen from '@/screens/Profile/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="TourDetail" component={TourDetailScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="HomeTab" component={HomeStack} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
```

---

## 🔐 인증 구현

```typescript
// mobile/src/services/auth/authService.ts
import { supabase } from '../supabase/client';

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
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

  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },
};
```

---

## 🎨 스타일링

React Native는 CSS 대신 StyleSheet를 사용:

```typescript
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  // ...
});
```

또는 styled-components 사용:

```bash
npm install styled-components
npm install --save-dev @types/styled-components-react-native
```

---

## 📦 빌드 및 배포

### 개발 빌드

```bash
# Android
npm run android

# 또는 Metro 번들러만 실행
npm start
```

### 릴리스 빌드

```bash
# Android APK 생성
cd android
./gradlew assembleRelease

# Android AAB 생성 (Play Store용)
./gradlew bundleRelease
```

---

## 🔄 코드 공유 전략

### Monorepo 사용 (추천)

```bash
# 루트에 package.json
{
  "workspaces": ["web", "mobile", "shared"]
}
```

### 공유 패키지 구조

```
shared/
├── types/
│   ├── tour.ts
│   └── booking.ts
├── api/
│   └── endpoints.ts
└── utils/
    └── format.ts
```

---

## 📋 체크리스트

### 프로젝트 설정
- [ ] React Native 프로젝트 생성
- [ ] 필수 패키지 설치
- [ ] 프로젝트 구조 생성
- [ ] 네비게이션 설정

### 기능 구현
- [ ] 인증 (로그인/회원가입)
- [ ] 홈 화면 (투어 목록)
- [ ] 투어 상세 화면
- [ ] 예약 기능
- [ ] 장바구니
- [ ] 프로필 화면

### 통합
- [ ] Supabase 연동
- [ ] API 클라이언트 설정
- [ ] 이미지 처리
- [ ] 푸시 알림 (선택)

### 빌드 및 배포
- [ ] Android 빌드 테스트
- [ ] 릴리스 빌드 생성
- [ ] Google Play Console 설정
- [ ] 앱 스토어 제출

---

## 🆘 문제 해결

### Metro 번들러 오류

```bash
# 캐시 정리
npm start -- --reset-cache
```

### Android 빌드 오류

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### 의존성 충돌

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules
npm install
```

---

## 📚 참고 자료

- [React Native 공식 문서](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native 가이드](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)

---

## 🎯 다음 단계

1. React Native 프로젝트 생성
2. 기본 네비게이션 설정
3. 홈 화면 구현
4. Supabase 연동
5. 주요 기능 구현

