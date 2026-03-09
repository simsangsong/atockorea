import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { BASE_URL } from '@/api/client';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Supabase client for the app.
 * 모든 데이터는 웹과 동일한 Supabase 프로젝트를 공유합니다 (shared DB).
 * - 사용자/인증(auth.users, user_profiles), 예약(bookings), 투어(tours) 등 동일 DB.
 * - 앱 환경 변수: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *   → 웹의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 와 동일한 값 사용.
 * Session is persisted in AsyncStorage so login state survives app restarts.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

/** Web app URL for sign-in / sign-up (same DB, so same auth) */
export const getWebAuthUrl = (path: 'signin' | 'signup' = 'signin') => {
  const base = process.env.EXPO_PUBLIC_APP_URL || 'https://www.atockorea.com';
  return `${base}/${path}`;
};
