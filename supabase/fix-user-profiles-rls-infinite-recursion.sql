-- ============================================
-- Fix Infinite Recursion in user_profiles RLS Policies
-- ============================================
-- 문제: "Admins can view all profiles" 정책이 user_profiles를 다시 조회하면서 무한 재귀 발생
-- 해결: 해당 정책을 제거하고 기본 정책만 사용

-- 모든 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;

-- 기본 정책만 생성 (무한 재귀 없음)
-- 1. 사용자는 자신의 프로필을 볼 수 있음
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. 사용자는 자신의 프로필을 생성할 수 있음
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. 사용자는 자신의 프로필을 수정할 수 있음
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 주의: "Admins can view all profiles" 정책은 제거했습니다.
-- 이유: 이 정책이 user_profiles를 다시 조회하면서 무한 재귀 발생
-- 
-- 대안:
-- - 서버 사이드 API에서는 service_role 키를 사용하므로 RLS를 우회합니다
-- - 클라이언트 사이드에서는 사용자가 자신의 프로필만 조회하므로 문제없습니다
-- - Admin이 다른 사용자 프로필을 조회해야 한다면 서버 사이드 API를 사용하세요

-- 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;





