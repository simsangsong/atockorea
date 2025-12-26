-- ============================================
-- AtoCKorea - 누락된 테이블 생성 SQL (안전 버전)
-- Supabase Dashboard의 SQL Editor에서 실행하세요
-- 이 버전은 기존 테이블을 삭제하지 않고 CREATE IF NOT EXISTS를 사용합니다
-- ============================================

-- ============================================
-- 1. 사용자 설정 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ko', 'zh')),
  currency TEXT DEFAULT 'USD' CHECK (currency IN ('USD', 'KRW', 'CNY')),
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  marketing_emails BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스는 테이블이 존재할 때만 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_settings_user_id') THEN
    CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
  END IF;
END $$;

-- ============================================
-- 2. 사용자 활동 로그 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('page_view', 'tour_view', 'booking_created', 'review_created', 'wishlist_added', 'cart_added', 'search', 'filter')),
  resource_type TEXT,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스는 테이블이 존재할 때만 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_activity_logs_user_id') THEN
    CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_activity_logs_activity_type') THEN
    CREATE INDEX idx_user_activity_logs_activity_type ON user_activity_logs(activity_type);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_activity_logs_created_at') THEN
    CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);
  END IF;
END $$;

-- ============================================
-- 3. 리뷰 반응 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS review_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, review_id)
);

-- 인덱스는 테이블이 존재할 때만 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_reactions_user_id') THEN
    CREATE INDEX idx_review_reactions_user_id ON review_reactions(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_reactions_review_id') THEN
    CREATE INDEX idx_review_reactions_review_id ON review_reactions(review_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_reactions_type') THEN
    CREATE INDEX idx_review_reactions_type ON review_reactions(reaction_type);
  END IF;
END $$;

-- ============================================
-- 4. 리뷰 신고 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'fake', 'offensive', 'other')),
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, review_id)
);

-- 인덱스는 테이블이 존재할 때만 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_reports_user_id') THEN
    CREATE INDEX idx_review_reports_user_id ON review_reports(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_reports_review_id') THEN
    CREATE INDEX idx_review_reports_review_id ON review_reports(review_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_review_reports_status') THEN
    CREATE INDEX idx_review_reports_status ON review_reports(status);
  END IF;
END $$;

-- ============================================
-- 5. 프로모션 코드 사용 기록 테이블 (이미 있을 수 있음)
-- ============================================
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스는 테이블이 존재할 때만 생성
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promo_code_usage_promo_code_id') THEN
    CREATE INDEX idx_promo_code_usage_promo_code_id ON promo_code_usage(promo_code_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promo_code_usage_user_id') THEN
    CREATE INDEX idx_promo_code_usage_user_id ON promo_code_usage(user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_promo_code_usage_booking_id') THEN
    CREATE INDEX idx_promo_code_usage_booking_id ON promo_code_usage(booking_id);
  END IF;
END $$;

-- ============================================
-- 트리거: updated_at 자동 업데이트
-- ============================================
-- update_updated_at_column 함수가 없으면 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성 (이미 있으면 교체)
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON user_settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_reports_updated_at ON review_reports;
CREATE TRIGGER update_review_reports_updated_at 
  BEFORE UPDATE ON review_reports
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS (Row Level Security) 활성화
-- ============================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 정책 (기본 정책)
-- ============================================

-- User Settings: 사용자는 자신의 설정만 볼 수 있음
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
CREATE POLICY "Users can update own settings"
  ON user_settings FOR ALL
  USING (auth.uid() = user_id);

-- User Activity Logs: 사용자는 자신의 활동 로그만 볼 수 있음
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity_logs;
CREATE POLICY "Users can view own activity"
  ON user_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own activity" ON user_activity_logs;
CREATE POLICY "Users can insert own activity"
  ON user_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Review Reactions: 모든 사용자가 볼 수 있음, 자신의 반응만 수정 가능
DROP POLICY IF EXISTS "Anyone can view reactions" ON review_reactions;
CREATE POLICY "Anyone can view reactions"
  ON review_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own reactions" ON review_reactions;
CREATE POLICY "Users can manage own reactions"
  ON review_reactions FOR ALL
  USING (auth.uid() = user_id);

-- Review Reports: 사용자는 자신의 신고만 볼 수 있음, 관리자는 모든 신고 볼 수 있음
DROP POLICY IF EXISTS "Users can view own reports" ON review_reports;
CREATE POLICY "Users can view own reports"
  ON review_reports FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create reports" ON review_reports;
CREATE POLICY "Users can create reports"
  ON review_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all reports" ON review_reports;
CREATE POLICY "Admins can view all reports"
  ON review_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update reports" ON review_reports;
CREATE POLICY "Admins can update reports"
  ON review_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Promo Code Usage: 사용자는 자신의 사용 기록만 볼 수 있음
DROP POLICY IF EXISTS "Users can view own promo usage" ON promo_code_usage;
CREATE POLICY "Users can view own promo usage"
  ON promo_code_usage FOR SELECT
  USING (auth.uid() = user_id);










