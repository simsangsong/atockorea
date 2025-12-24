# React Native 빠른 시작 가이드

## ⚡ 5분 안에 시작하기

### 1. React Native 프로젝트 생성

```bash
# 새 디렉토리에서
npx react-native@latest init AtoCKoreaMobile --template react-native-template-typescript

cd AtoCKoreaMobile
```

### 2. 필수 패키지 설치

```bash
# 네비게이션
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# Supabase
npm install @supabase/supabase-js @react-native-async-storage/async-storage

# 네트워크
npm install axios
```

### 3. Supabase 설정

`.env` 파일 생성:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 4. Supabase 클라이언트 생성

`src/services/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

### 5. 첫 번째 화면 생성

`src/screens/HomeScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { supabase } from '../services/supabase/client';

export default function HomeScreen() {
  const [tours, setTours] = useState([]);

  useEffect(() => {
    loadTours();
  }, []);

  const loadTours = async () => {
    const { data } = await supabase
      .from('tours')
      .select('*')
      .limit(10);
    if (data) setTours(data);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AtoC Korea</Text>
      <FlatList
        data={tours}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text>{item.title}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  card: { padding: 16, backgroundColor: '#f0f0f0', marginBottom: 8, borderRadius: 8 },
});
```

### 6. 앱 실행

```bash
# Android
npm run android

# Metro 번들러만 실행
npm start
```

---

## 🎉 완료!

기본적인 React Native 앱이 실행되었습니다.

다음 단계는 `docs/REACT_NATIVE_SETUP.md`를 참고하세요.





