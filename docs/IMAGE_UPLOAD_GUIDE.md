# 이미지 업로드 가이드

## 방법 1: Admin Panel에서 업로드 (추천)

### 1. Admin Panel 접속
1. `http://localhost:3000/admin` 접속
2. 로그인 (admin 권한 필요)
3. 왼쪽 메뉴에서 **"이미지 업로드"** 클릭

### 2. 이미지 업로드
1. **메인 이미지** 섹션:
   - 클릭하거나 드래그하여 단일 이미지 업로드
   - 투어의 대표 이미지로 사용

2. **갤러리 이미지** 섹션:
   - 여러 이미지를 한 번에 업로드 가능
   - 투어 상세 페이지 갤러리에 표시

### 3. URL 복사
- 업로드 완료 후 표시된 URL을 복사
- "복사" 버튼 클릭 또는 URL 직접 복사
- "모든 URL 복사 (JSON)" 버튼으로 갤러리 이미지들을 JSON 배열 형식으로 복사

### 4. SQL에 사용
복사한 URL을 SQL INSERT 문에 사용:

```sql
INSERT INTO tours (
  title,
  slug,
  city,
  price,
  price_type,
  image_url,  -- 여기에 메인 이미지 URL 붙여넣기
  gallery_images,  -- 여기에 갤러리 이미지 JSON 배열 붙여넣기
  ...
) VALUES (
  '투어 제목',
  'tour-slug',
  'Seoul',
  100000,
  'person',
  'https://your-supabase-url.supabase.co/storage/v1/object/public/tour-images/...',  -- 메인 이미지
  '["https://...", "https://..."]'::jsonb,  -- 갤러리 이미지
  ...
);
```

## 방법 2: API 직접 호출

### cURL 사용

```bash
# 단일 이미지 업로드
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -F "file=@/path/to/your/image.jpg" \
  -F "type=product" \
  -F "folder=tours"

# 여러 이미지 업로드
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.jpg" \
  -F "type=gallery" \
  -F "folder=tours/gallery"
```

### JavaScript/TypeScript 사용

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('type', 'product');
formData.append('folder', 'tours');

const response = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${sessionToken}`,
  },
  credentials: 'include',
  body: formData,
});

const result = await response.json();
console.log('Uploaded URL:', result.url);
```

## Supabase Storage 설정

### 1. Storage Bucket 생성

1. Supabase Dashboard 접속
2. 왼쪽 메뉴에서 **Storage** 클릭
3. **New bucket** 클릭
4. 다음 버킷 생성:
   - **이름**: `tour-images` (공개)
   - **이름**: `tour-gallery` (공개)

### 2. Storage Policies 설정

`supabase/storage-setup.sql` 파일을 Supabase SQL Editor에서 실행:

```sql
-- 공개 읽기 정책
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
```

## 이미지 파일 요구사항

### 지원 형식
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

### 크기 제한
- **메인 이미지**: 최대 5MB
- **갤러리 이미지**: 최대 5MB (각 파일)

### 권장 사양
- **메인 이미지**: 1200x800px 이상
- **갤러리 이미지**: 800x600px 이상
- **비율**: 3:2 또는 16:9 권장

## 업로드된 이미지 사용 예시

### SQL INSERT 예시

```sql
WITH new_tour AS (
  INSERT INTO tours (
    title,
    slug,
    city,
    price,
    price_type,
    image_url,
    gallery_images,
    ...
  ) VALUES (
    'Seoul City Tour',
    'seoul-city-tour',
    'Seoul',
    50000,
    'person',
    'https://cghyvbwmijgpahnoduyv.supabase.co/storage/v1/object/public/tour-images/tours/1234567890-abc123.jpg',  -- 업로드한 메인 이미지 URL
    '[
      "https://cghyvbwmijgpahnoduyv.supabase.co/storage/v1/object/public/tour-gallery/tours/gallery/1234567890-def456.jpg",
      "https://cghyvbwmijgpahnoduyv.supabase.co/storage/v1/object/public/tour-gallery/tours/gallery/1234567890-ghi789.jpg"
    ]'::jsonb,  -- 업로드한 갤러리 이미지 URL들
    ...
  )
  RETURNING id
)
...
```

## 이미지 삭제

### Admin Panel에서
- 업로드된 이미지 목록에서 삭제 버튼 클릭

### API로 삭제

```bash
curl -X DELETE "http://localhost:3000/api/upload?path=tours/1234567890-abc123.jpg&bucket=tour-images" \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN"
```

## 문제 해결

### "Bucket not found" 에러
- Supabase Dashboard에서 `tour-images`와 `tour-gallery` 버킷이 생성되어 있는지 확인
- 버킷이 공개(Public)로 설정되어 있는지 확인

### "Authentication required" 에러
- 로그인 상태 확인
- Admin 권한 확인

### 업로드 실패
- 파일 크기 확인 (5MB 이하)
- 파일 형식 확인 (JPG, PNG, WebP만 가능)
- 네트워크 연결 확인

## 팁

1. **파일명**: 업로드 시 자동으로 고유한 파일명이 생성됩니다
2. **URL 복사**: 업로드 완료 후 즉시 URL을 복사하여 SQL에 사용하세요
3. **갤러리 이미지**: 여러 이미지를 한 번에 업로드하면 JSON 배열 형식으로 복사할 수 있습니다
4. **이미지 최적화**: 업로드 전에 이미지를 최적화하면 로딩 속도가 빨라집니다

