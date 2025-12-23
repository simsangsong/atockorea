# React Native 프로젝트 구조

## 📁 권장 디렉토리 구조

```
AtoCKoreaMobile/
├── src/
│   ├── screens/              # 화면 컴포넌트
│   │   ├── Auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── SignUpScreen.tsx
│   │   ├── Home/
│   │   │   └── HomeScreen.tsx
│   │   ├── Tours/
│   │   │   ├── ToursListScreen.tsx
│   │   │   └── TourDetailScreen.tsx
│   │   ├── Booking/
│   │   │   ├── BookingScreen.tsx
│   │   │   └── BookingConfirmationScreen.tsx
│   │   ├── Cart/
│   │   │   └── CartScreen.tsx
│   │   ├── Profile/
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── MyBookingsScreen.tsx
│   │   │   └── SettingsScreen.tsx
│   │   └── Merchant/
│   │       ├── MerchantDashboardScreen.tsx
│   │       └── MerchantOrdersScreen.tsx
│   │
│   ├── components/           # 재사용 가능한 컴포넌트
│   │   ├── TourCard/
│   │   │   ├── TourCard.tsx
│   │   │   └── TourCard.styles.ts
│   │   ├── Header/
│   │   │   └── Header.tsx
│   │   ├── Button/
│   │   │   └── Button.tsx
│   │   ├── Input/
│   │   │   └── Input.tsx
│   │   └── Loading/
│   │       └── Loading.tsx
│   │
│   ├── navigation/           # 네비게이션 설정
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── TabNavigator.tsx
│   │
│   ├── services/             # API 및 서비스
│   │   ├── supabase/
│   │   │   └── client.ts
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── auth/
│   │   │   └── authService.ts
│   │   └── booking/
│   │       └── bookingService.ts
│   │
│   ├── hooks/                # 커스텀 훅
│   │   ├── useAuth.ts
│   │   ├── useTours.ts
│   │   └── useBooking.ts
│   │
│   ├── store/                # 상태 관리 (Zustand/Redux)
│   │   ├── authStore.ts
│   │   └── tourStore.ts
│   │
│   ├── types/                # TypeScript 타입
│   │   ├── tour.ts
│   │   ├── booking.ts
│   │   ├── user.ts
│   │   └── index.ts
│   │
│   ├── utils/                # 유틸리티 함수
│   │   ├── format.ts
│   │   ├── validation.ts
│   │   └── constants.ts
│   │
│   └── constants/            # 상수
│       ├── colors.ts
│       ├── sizes.ts
│       └── routes.ts
│
├── android/                  # Android 네이티브 코드
├── ios/                      # iOS 네이티브 코드 (나중에)
├── App.tsx                   # 앱 진입점
└── package.json
```

---

## 🔄 웹과의 코드 공유 전략

### Monorepo 구조 (추천)

```
atockorea-workspace/
├── packages/
│   ├── web/              # Next.js 앱
│   ├── mobile/           # React Native 앱
│   └── shared/           # 공유 코드
│       ├── types/
│       ├── utils/
│       └── constants/
└── package.json
```

### 공유 가능한 코드

1. **타입 정의** - `shared/types/`
2. **유틸리티 함수** - `shared/utils/`
3. **상수** - `shared/constants/`
4. **비즈니스 로직** - 일부 공유 가능

### 공유 불가능한 코드

1. **컴포넌트** - React와 React Native가 다름
2. **스타일링** - CSS vs StyleSheet
3. **네비게이션** - Next.js Router vs React Navigation
4. **API 라우트** - Next.js 전용

---

## 📝 파일 예시

### App.tsx

```typescript
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import { supabase } from './src/services/supabase/client';
import { View, ActivityIndicator } from 'react-native';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {session ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
```

### src/navigation/AppNavigator.tsx

```typescript
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from '@/screens/Home/HomeScreen';
import ToursListScreen from '@/screens/Tours/ToursListScreen';
import TourDetailScreen from '@/screens/Tours/TourDetailScreen';
import CartScreen from '@/screens/Cart/CartScreen';
import ProfileScreen from '@/screens/Profile/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="TourDetail" component={TourDetailScreen} />
    </Stack.Navigator>
  );
}

function ToursStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ToursList" component={ToursListScreen} />
      <Stack.Screen name="TourDetail" component={TourDetailScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Home' }} />
      <Tab.Screen name="ToursTab" component={ToursStack} options={{ title: 'Tours' }} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
```

---

## ✅ 체크리스트

- [ ] 프로젝트 구조 생성
- [ ] 네비게이션 설정
- [ ] 주요 화면 구현
- [ ] 공유 코드 분리 (선택사항)
- [ ] 타입 정의
- [ ] 상태 관리 설정




