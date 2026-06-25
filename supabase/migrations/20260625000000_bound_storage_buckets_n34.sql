-- N34: bound the two public storage buckets that had no upload constraints.
--
-- `email-assets` and `product-images` were created with file_size_limit = NULL
-- and allowed_mime_types = NULL, i.e. any size / any MIME type could be uploaded
-- (the other image buckets, tour-images/tour-gallery, are already bounded). These
-- limits are enforced at upload time only and do not affect existing objects or
-- public reads, so this is additive and safe:
--   - email-assets currently holds 1 small PNG (~217 KB); only the service role
--     writes it (no INSERT policy on the bucket).
--   - product-images is currently empty; its "Auth Upload" INSERT policy already
--     gates on auth.role() = 'authenticated' via WITH CHECK.
--
-- Idempotent: plain UPDATEs that can be re-applied.

UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5 MB (logos/banners are tiny)
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
WHERE id = 'email-assets';

UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10 MB (matches tour-gallery)
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
WHERE id = 'product-images';
