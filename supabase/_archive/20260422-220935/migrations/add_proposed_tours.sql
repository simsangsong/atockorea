-- 발의된 투어 (AI 커스터마이즈 조인 투어에서 확정 후 공개)
CREATE TABLE IF NOT EXISTS proposed_tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  summary TEXT,
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  participants INTEGER NOT NULL CHECK (participants >= 3 AND participants <= 13),
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('van', 'large_van')),
  total_price_krw INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposed_tours_status ON proposed_tours(status);
CREATE INDEX IF NOT EXISTS idx_proposed_tours_created_at ON proposed_tours(created_at DESC);

COMMENT ON TABLE proposed_tours IS 'Semi-F.I.T custom join tours proposed by users (visible for others to join)';
