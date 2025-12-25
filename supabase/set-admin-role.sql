-- ============================================
-- Set Admin Role for admin@atockorea.com
-- ============================================
-- User ID: 39ab927c-9acb-4f52-a4fb-08d9153f0c05
-- Email: admin@atockorea.com

-- 방법 1: INSERT (프로필이 없는 경우)
INSERT INTO user_profiles (id, full_name, role)
VALUES ('39ab927c-9acb-4f52-a4fb-08d9153f0c05', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 방법 2: UPDATE (프로필이 이미 있는 경우)
-- UPDATE user_profiles
-- SET role = 'admin', full_name = 'Admin User'
-- WHERE id = '39ab927c-9acb-4f52-a4fb-08d9153f0c05';

-- 확인: Admin 역할이 제대로 설정되었는지 확인
SELECT id, full_name, role, created_at
FROM user_profiles
WHERE id = '39ab927c-9acb-4f52-a4fb-08d9153f0c05';





