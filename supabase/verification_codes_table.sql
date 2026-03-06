-- verification_codes table (matches complete-database-schema and API: code_type, is_used)
-- Run this in Supabase SQL Editor if you see "Failed to store verification code" / verification_codes table missing.
-- Service role (used by API) bypasses RLS; no extra policies needed.

CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  phone TEXT,
  code TEXT NOT NULL,
  code_type TEXT NOT NULL CHECK (code_type IN ('email_verification', 'phone_verification', 'password_reset', 'login')),
  is_used BOOLEAN DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires_at ON verification_codes(expires_at);

COMMENT ON TABLE verification_codes IS 'Email/phone verification codes for signup and password reset';
