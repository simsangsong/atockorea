-- ============================================
-- AtoCKorea Settlement Schema Extension
-- 结算功能数据库扩展
-- ============================================

-- ============================================
-- 1. 在bookings表中添加settlement_status字段
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'settlement_status'
  ) THEN
    ALTER TABLE bookings ADD COLUMN settlement_status TEXT DEFAULT 'pending' 
      CHECK (settlement_status IN ('pending', 'settled', 'cancelled'));
    CREATE INDEX idx_bookings_settlement_status ON bookings(settlement_status);
  END IF;
END $$;

-- ============================================
-- 2. 结算记录表 (Settlements)
-- ============================================
CREATE TABLE IF NOT EXISTS settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- 结算周期
  settlement_period_start DATE NOT NULL,
  settlement_period_end DATE NOT NULL,
  
  -- 结算金额
  total_revenue DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 总收入
  platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 平台手续费
  merchant_payout DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 商家应得金额
  
  -- 订单统计
  total_bookings INTEGER NOT NULL DEFAULT 0, -- 订单总数
  settled_bookings INTEGER NOT NULL DEFAULT 0, -- 已结算订单数
  
  -- 结算状态
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- 支付信息
  payout_method TEXT, -- 'bank_transfer', 'paypal', etc.
  payout_reference TEXT, -- 转账参考号
  payout_date DATE, -- 实际支付日期
  
  -- 备注
  notes TEXT,
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 确保每个商家在同一结算周期只有一条记录
  CONSTRAINT unique_merchant_settlement_period 
    UNIQUE(merchant_id, settlement_period_start, settlement_period_end)
);

CREATE INDEX IF NOT EXISTS idx_settlements_merchant_id ON settlements(merchant_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(settlement_period_start, settlement_period_end);

-- ============================================
-- 3. 结算订单关联表 (Settlement Bookings)
-- 记录哪些订单被包含在哪个结算中
-- ============================================
CREATE TABLE IF NOT EXISTS settlement_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id UUID NOT NULL REFERENCES settlements(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- 订单金额信息（快照，防止订单金额后续变更影响已结算记录）
  booking_revenue DECIMAL(10, 2) NOT NULL, -- 订单收入
  platform_fee_amount DECIMAL(10, 2) NOT NULL, -- 该订单的平台手续费
  merchant_payout_amount DECIMAL(10, 2) NOT NULL, -- 该订单的商家应得
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 确保每个订单只能被结算一次
  CONSTRAINT unique_booking_settlement UNIQUE(booking_id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_bookings_settlement_id ON settlement_bookings(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_bookings_booking_id ON settlement_bookings(booking_id);

-- ============================================
-- 4. 自动更新updated_at的触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_settlement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_settlement_updated_at_trigger
  BEFORE UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_settlement_updated_at();

-- ============================================
-- 5. 结算完成时自动更新订单的settlement_status
-- ============================================
CREATE OR REPLACE FUNCTION update_booking_settlement_status()
RETURNS TRIGGER AS $$
BEGIN
  -- 当结算状态变为completed时，更新所有相关订单的settlement_status
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE bookings
    SET settlement_status = 'settled'
    WHERE id IN (
      SELECT booking_id 
      FROM settlement_bookings 
      WHERE settlement_id = NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_booking_settlement_status_trigger
  AFTER UPDATE ON settlements
  FOR EACH ROW
  EXECUTE FUNCTION update_booking_settlement_status();

-- ============================================
-- 6. 视图：商家结算概览
-- ============================================
CREATE OR REPLACE VIEW merchant_settlement_summary AS
SELECT 
  m.id AS merchant_id,
  m.company_name,
  COUNT(DISTINCT s.id) AS total_settlements,
  COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) AS completed_settlements,
  COUNT(DISTINCT CASE WHEN s.status = 'pending' OR s.status = 'processing' THEN s.id END) AS pending_settlements,
  COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.merchant_payout ELSE 0 END), 0) AS total_paid_out,
  COALESCE(SUM(CASE WHEN s.status = 'pending' OR s.status = 'processing' THEN s.merchant_payout ELSE 0 END), 0) AS pending_payout,
  COUNT(DISTINCT b.id) AS total_bookings,
  COUNT(DISTINCT CASE WHEN b.settlement_status = 'settled' THEN b.id END) AS settled_bookings,
  COUNT(DISTINCT CASE WHEN b.settlement_status = 'pending' AND b.payment_status = 'paid' THEN b.id END) AS pending_settlement_bookings
FROM merchants m
LEFT JOIN settlements s ON s.merchant_id = m.id
LEFT JOIN bookings b ON b.merchant_id = m.id
GROUP BY m.id, m.company_name;

-- ============================================
-- 7. RLS (Row Level Security) Policies
-- ============================================
-- 启用RLS
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_bookings ENABLE ROW LEVEL SECURITY;

-- 商家只能查看自己的结算记录
CREATE POLICY "Merchants can view their own settlements"
  ON settlements FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- 管理员可以查看所有结算记录
CREATE POLICY "Admins can view all settlements"
  ON settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 商家只能查看自己结算中的订单
CREATE POLICY "Merchants can view their own settlement bookings"
  ON settlement_bookings FOR SELECT
  USING (
    settlement_id IN (
      SELECT id FROM settlements 
      WHERE merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
      )
    )
  );

-- 管理员可以查看所有结算订单
CREATE POLICY "Admins can view all settlement bookings"
  ON settlement_bookings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


