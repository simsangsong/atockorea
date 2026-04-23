-- user_profiles 테이블에 INSERT 정책 추가 (회원가입 시 프로필 생성 허용)
-- localhost:3000 이 아니라 Supabase DB에 이 정책이 없어서 401/RLS 에러가 납니다. 반드시 실행하세요.
-- Supabase 대시보드 → SQL Editor → 새 쿼리 → 아래 내용 붙여넣기 → Run

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
