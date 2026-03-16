-- =============================================================================
-- auth.users INSERT 시 public.user_profiles 자동 생성 (인증 성공 후 데이터 동기화)
-- Supabase 대시보드 SMTP(Resend) + signInWithOtp/verifyOtp 사용 시 인증 성공 후
-- auth.users에 행이 생기면 이 트리거가 user_profiles에 행을 만들어 줌.
-- =============================================================================

-- user_profiles에 email, auth_provider 없으면 추가 (트리거에서 사용)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_provider ON user_profiles(auth_provider);

-- 트리거 함수: auth.users에 새 사용자 INSERT 시 user_profiles에 한 행 삽입
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, auth_provider, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email'),
    NEW.raw_user_meta_data->>'full_name'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    auth_provider = EXCLUDED.auth_provider,
    full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'auth.users INSERT 시 user_profiles에 동기화 (OTP/회원가입 후 데이터 쌓이게 함)';

-- 기존 트리거 있으면 제거 후 재생성 (이름 통일)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
