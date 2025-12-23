-- Supabase Storage 설정 SQL
-- Storage 버킷 생성 및 정책 설정

-- ============================================
-- 1. Storage Buckets 생성
-- ============================================
-- 주의: 버킷은 Supabase Dashboard에서 생성해야 합니다.
-- 이 SQL은 정책만 설정합니다.

-- ============================================
-- 2. Storage Policies (tour-images 버킷)
-- ============================================

-- 공개 읽기 정책 (모든 사용자)
CREATE POLICY "Public read access for tour-images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tour-images' );

-- 인증된 사용자 업로드 정책
CREATE POLICY "Authenticated users can upload to tour-images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tour-images' AND
  auth.role() = 'authenticated'
);

-- 사용자가 자신의 파일 업데이트
CREATE POLICY "Users can update own files in tour-images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tour-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 사용자가 자신의 파일 삭제
CREATE POLICY "Users can delete own files in tour-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 3. Storage Policies (tour-gallery 버킷)
-- ============================================

-- 공개 읽기 정책
CREATE POLICY "Public read access for tour-gallery"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tour-gallery' );

-- 인증된 사용자 업로드 정책
CREATE POLICY "Authenticated users can upload to tour-gallery"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tour-gallery' AND
  auth.role() = 'authenticated'
);

-- 사용자가 자신의 파일 업데이트
CREATE POLICY "Users can update own files in tour-gallery"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'tour-gallery' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 사용자가 자신의 파일 삭제
CREATE POLICY "Users can delete own files in tour-gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-gallery' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- 4. Admin 권한 (관리자는 모든 파일 관리 가능)
-- ============================================

-- Admin이 모든 파일 삭제 가능 (tour-images)
CREATE POLICY "Admins can delete any file in tour-images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-images' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admin이 모든 파일 삭제 가능 (tour-gallery)
CREATE POLICY "Admins can delete any file in tour-gallery"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-gallery' AND
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);




