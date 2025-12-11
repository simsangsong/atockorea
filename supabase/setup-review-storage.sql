-- ============================================
-- Supabase Storage 设置脚本
-- Review Photos Storage Setup
-- ============================================

-- 注意：此脚本需要在 Supabase Dashboard 中手动执行
-- 因为 Storage bucket 需要通过 Dashboard 或 API 创建

-- ============================================
-- 1. 创建 Storage Bucket (需要在 Dashboard 中手动创建)
-- ============================================
-- 步骤：
-- 1. 进入 Supabase Dashboard
-- 2. 点击左侧菜单 "Storage"
-- 3. 点击 "Create bucket"
-- 4. 设置：
--    - Name: review-photos
--    - Public bucket: ✅ 勾选
--    - File size limit: 5MB
--    - Allowed MIME types: image/*

-- ============================================
-- 2. Storage 权限策略
-- ============================================

-- 允许认证用户上传照片
CREATE POLICY IF NOT EXISTS "Users can upload review photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-photos');

-- 允许所有人查看照片
CREATE POLICY IF NOT EXISTS "Anyone can view review photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-photos');

-- 允许用户删除自己上传的照片
CREATE POLICY IF NOT EXISTS "Users can delete their own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'review-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户更新自己上传的照片
CREATE POLICY IF NOT EXISTS "Users can update their own photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'review-photos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

