-- =============================================================================
-- AtoCKorea: Auth 관련 public 스키마 (user_profiles + verification_codes)
-- 반드시 20250316000000_auth_users_sync_user_profiles.sql 보다 먼저 실행되도록
-- 타임스탬프를 20250315000005 로 둠 (user_profiles가 없으면 해당 마이그레이션 실패).
-- Supabase SQL Editor에서 단독 실행 가능, idempotent.
-- =============================================================================

-- gen_random_uuid() 사용 (Supabase Postgres 기본)

-- ---------------------------------------------------------------------------
-- 1) user_profiles — auth.users 와 1:1, 앱의 create-profile / OAuth 콜백과 정합
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS language_preference TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS birth_year INTEGER,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role IS NULL OR role IN ('customer', 'merchant', 'admin'));

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_language_preference_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_language_preference_check
  CHECK (
    language_preference IS NULL
    OR language_preference IN ('en', 'zh', 'ko', 'zh-TW', 'es', 'ja')
  );

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles (role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_auth_provider ON public.user_profiles (auth_provider);

COMMENT ON TABLE public.user_profiles IS '앱 사용자 확장 프로필; id = auth.users.id';
COMMENT ON COLUMN public.user_profiles.email IS 'auth/OAuth와 동기화된 이메일(조회·관리용)';
COMMENT ON COLUMN public.user_profiles.auth_provider IS 'email, google, line 등';

CREATE OR REPLACE FUNCTION public.user_profiles_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE public.user_profiles_set_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 2) verification_codes — 모바일 /api/auth/send-verification-code, verify-code
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  email TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL,
  code_type TEXT NOT NULL,
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW (),
  CONSTRAINT verification_codes_code_type_check CHECK (
    code_type IN (
      'email_verification',
      'phone_verification',
      'password_reset',
      'login'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON public.verification_codes (email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON public.verification_codes (phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON public.verification_codes (code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON public.verification_codes (expires_at);

COMMENT ON TABLE public.verification_codes IS '커스텀 이메일 인증번호(모바일 가입 등). API는 service role 사용.';

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
