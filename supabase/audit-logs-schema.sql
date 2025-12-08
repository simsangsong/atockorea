-- ============================================
-- Audit Logs Table for Security
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- e.g., 'merchant_created', 'product_updated', 'order_cancelled'
  resource_type TEXT NOT NULL, -- e.g., 'merchant', 'product', 'order'
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb, -- Additional context
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- RLS: Only admins can view audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

-- Function to automatically log IP and user agent
CREATE OR REPLACE FUNCTION log_audit_with_context()
RETURNS TRIGGER AS $$
BEGIN
  -- This would be called from application layer with IP and user agent
  RETURN NEW;
END;
$$ language 'plpgsql';

