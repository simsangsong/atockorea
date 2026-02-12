# Supabase Storage 설정 가이드

## 🔴 이미지 업로드 오류 해결

"Failed to upload file" 오류는 대부분 Supabase Storage bucket이 없어서 발생합니다.

## ✅ 해결 방법

### 1. Supabase Dashboard 접속

1. https://supabase.com 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **Storage** 클릭

### 2. Storage Bucket 생성

#### Bucket 1: `tour-images` (썸네일 이미지용)

1. **"New bucket"** 버튼 클릭
2. **Bucket name**: `tour-images` (정확히 이 이름)
3. **Public bucket**: ✅ 체크 (공개 접근 허용)
4. **File size limit**: 5 MB (또는 원하는 크기)
5. **Allowed MIME types**: 
   - `image/jpeg`
   - `image/jpg`
   - `image/png`
   - `image/webp`
6. **"Create bucket"** 클릭

#### Bucket 2: `tour-gallery` (갤러리 이미지용)

1. **"New bucket"** 버튼 클릭
2. **Bucket name**: `tour-gallery` (정확히 이 이름)
3. **Public bucket**: ✅ 체크 (공개 접근 허용)
4. **File size limit**: 10 MB (또는 원하는 크기)
5. **Allowed MIME types**: 
   - `image/jpeg`
   - `image/jpg`
   - `image/png`
   - `image/webp`
6. **"Create bucket"** 클릭

### 3. Storage 정책 설정 (RLS)

각 bucket에 대해 다음 정책을 설정해야 합니다:

#### 정책 1: Public 읽기 권한

1. Storage → `tour-images` → **Policies** 탭
2. **"New Policy"** 클릭
3. **Policy name**: `Public read access`
4. **Allowed operation**: `SELECT`
5. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images')
   ```
6. **"Review"** → **"Save policy"**

같은 방식으로 `tour-gallery` bucket에도 동일한 정책 추가.

#### 정책 2: 인증된 사용자 업로드 권한

1. Storage → `tour-images` → **Policies** 탭
2. **"New Policy"** 클릭
3. **Policy name**: `Authenticated users can upload`
4. **Allowed operation**: `INSERT`
5. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
6. **"Review"** → **"Save policy"**

같은 방식으로 `tour-gallery` bucket에도 동일한 정책 추가.

#### 정책 3: 인증된 사용자 업데이트 권한

1. Storage → `tour-images` → **Policies** 탭
2. **"New Policy"** 클릭
3. **Policy name**: `Authenticated users can update`
4. **Allowed operation**: `UPDATE`
5. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
6. **"Review"** → **"Save policy"**

같은 방식으로 `tour-gallery` bucket에도 동일한 정책 추가.

#### 정책 4: 인증된 사용자 삭제 권한

1. Storage → `tour-images` → **Policies** 탭
2. **"New Policy"** 클릭
3. **Policy name**: `Authenticated users can delete`
4. **Allowed operation**: `DELETE`
5. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
6. **"Review"** → **"Save policy"**

같은 방식으로 `tour-gallery` bucket에도 동일한 정책 추가.

### 4. Admin 전용 업로드 (선택사항)

Admin만 업로드할 수 있도록 하려면:

1. Storage → `tour-images` → **Policies** 탭
2. 기존 INSERT 정책 편집
3. **Policy definition**을 다음으로 변경:
   ```sql
   (
     bucket_id = 'tour-images' 
     AND auth.role() = 'authenticated'
     AND EXISTS (
       SELECT 1 FROM user_profiles 
       WHERE id = auth.uid() AND role = 'admin'
     )
   )
   ```

## ✅ 확인 방법

### 1. Bucket 생성 확인

Storage 메뉴에서 다음 bucket들이 보여야 합니다:
- ✅ `tour-images`
- ✅ `tour-gallery`

### 2. 정책 확인

각 bucket의 **Policies** 탭에서 다음 정책들이 있어야 합니다:
- ✅ Public read access (SELECT)
- ✅ Authenticated users can upload (INSERT)
- ✅ Authenticated users can update (UPDATE)
- ✅ Authenticated users can delete (DELETE)

### 3. 테스트 업로드

1. Admin 페이지에서 상품 편집
2. Images 탭에서 이미지 업로드 시도
3. 오류가 없으면 성공!

## 🔍 문제 해결

### Bucket을 찾을 수 없다는 오류

**오류 메시지**: `Storage bucket "tour-images" not found`

**해결**:
1. Supabase Dashboard → Storage 확인
2. Bucket 이름이 정확한지 확인 (`tour-images`, `tour-gallery`)
3. 대소문자 구분 확인 (소문자로 작성)

### 권한 오류

**오류 메시지**: `new row violates row-level security policy`

**해결**:
1. Storage → Policies 확인
2. INSERT 정책이 올바르게 설정되었는지 확인
3. Public bucket으로 설정되어 있는지 확인

### 파일 크기 제한 오류

**오류 메시지**: `File size exceeds limit`

**해결**:
1. Bucket 설정에서 File size limit 확인
2. `tour-images`: 최소 5MB
3. `tour-gallery`: 최소 10MB
4. 필요시 제한 증가

## 📋 빠른 체크리스트

- [ ] `tour-images` bucket 생성됨
- [ ] `tour-gallery` bucket 생성됨
- [ ] 두 bucket 모두 Public으로 설정됨
- [ ] SELECT 정책 추가됨 (Public read)
- [ ] INSERT 정책 추가됨 (Authenticated users)
- [ ] UPDATE 정책 추가됨 (Authenticated users)
- [ ] DELETE 정책 추가됨 (Authenticated users)
- [ ] 파일 크기 제한 설정됨
- [ ] MIME types 제한 설정됨

## 🎯 완료!

이제 이미지 업로드가 정상적으로 작동해야 합니다!









