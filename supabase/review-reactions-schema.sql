-- ============================================
-- 评价互动表 (REVIEW REACTIONS)
-- 用于存储用户对评价的点赞和不推荐
-- ============================================
CREATE TABLE IF NOT EXISTS review_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 反应类型: 'like' (点赞) 或 'dislike' (不推荐)
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('like', 'dislike')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户对每个评价只能有一种反应
  CONSTRAINT unique_user_review_reaction UNIQUE (user_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reactions_review_id ON review_reactions(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_user_id ON review_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_review_reactions_type ON review_reactions(reaction_type);

-- 更新 reviews 表，添加匿名选项和统计字段
ALTER TABLE reviews 
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislike_count INTEGER DEFAULT 0;

-- 创建触发器：自动更新点赞/不推荐数量
CREATE OR REPLACE FUNCTION update_review_reaction_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE reviews
    SET 
      like_count = (
        SELECT COUNT(*) 
        FROM review_reactions 
        WHERE review_id = NEW.review_id AND reaction_type = 'like'
      ),
      dislike_count = (
        SELECT COUNT(*) 
        FROM review_reactions 
        WHERE review_id = NEW.review_id AND reaction_type = 'dislike'
      ),
      updated_at = NOW()
    WHERE id = NEW.review_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE reviews
    SET 
      like_count = (
        SELECT COUNT(*) 
        FROM review_reactions 
        WHERE review_id = OLD.review_id AND reaction_type = 'like'
      ),
      dislike_count = (
        SELECT COUNT(*) 
        FROM review_reactions 
        WHERE review_id = OLD.review_id AND reaction_type = 'dislike'
      ),
      updated_at = NOW()
    WHERE id = OLD.review_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_review_reaction_counts
  AFTER INSERT OR UPDATE OR DELETE ON review_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_review_reaction_counts();

-- ============================================
-- 评价举报表 (REVIEW REPORTS)
-- ============================================
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 举报原因
  reason TEXT NOT NULL CHECK (reason IN (
    'spam',           -- 垃圾信息
    'inappropriate',  -- 不当内容
    'fake',           -- 虚假评价
    'harassment',     -- 骚扰
    'other'           -- 其他
  )),
  
  -- 举报详情
  description TEXT,
  
  -- 举报状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- 待处理
    'reviewing',  -- 审核中
    'resolved',   -- 已处理
    'dismissed'   -- 已驳回
  )),
  
  -- 处理信息
  handled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- 处理人（管理员）
  handled_at TIMESTAMP WITH TIME ZONE,
  handling_notes TEXT,  -- 处理备注
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个用户对每个评价只能举报一次
  CONSTRAINT unique_user_review_report UNIQUE (reporter_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_reporter_id ON review_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);
CREATE INDEX IF NOT EXISTS idx_review_reports_created_at ON review_reports(created_at DESC);

-- 创建视图：举报统计（用于总台dashboard）
CREATE OR REPLACE VIEW review_reports_summary AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'reviewing') as reviewing_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed_count,
  COUNT(*) as total_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as last_24h_count,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7d_count
FROM review_reports;

-- RLS 策略
ALTER TABLE review_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;

-- review_reactions: 用户可以查看所有反应，但只能创建/更新/删除自己的反应
CREATE POLICY "Users can view all reactions"
  ON review_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own reactions"
  ON review_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reactions"
  ON review_reactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions"
  ON review_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- review_reports: 用户可以创建举报，管理员可以查看和处理
CREATE POLICY "Users can create reports"
  ON review_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports"
  ON review_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON review_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update reports"
  ON review_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

