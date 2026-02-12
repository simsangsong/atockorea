# 이미지 업로드 API 설정 가이드

## 📋 개요

Supabase Storage를 사용한 이미지 업로드 API가 구현되었습니다.

## 🗂️ Supabase Storage 설정

### 1. Storage Bucket 생성

1. **Supabase Dashboard** 접속
2. **Storage** 메뉴 클릭
3. **"New bucket"** 클릭
4. 다음 버킷들을 생성:

#### Bucket 1: `tour-images`
- **Name:** `tour-images`
- **Public bucket:** ✅ 체크 (공개 읽기 허용)
- **File size limit:** 5 MB
- **Allowed MIME types:** `image/jpeg, image/png, image/webp`

#### Bucket 2: `tour-gallery`
- **Name:** `tour-gallery`
- **Public bucket:** ✅ 체크
- **File size limit:** 10 MB
- **Allowed MIME types:** `image/jpeg, image/png, image/webp`

### 2. Storage 정책 설정

각 버킷에 대해 Storage Policies를 설정해야 합니다.

#### 공개 읽기 정책 (모든 사용자)

```sql
-- tour-images 버킷
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tour-images' );

-- tour-gallery 버킷
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'tour-gallery' );
```

#### 업로드 정책 (인증된 사용자)

```sql
-- tour-images 버킷 (인증된 사용자만 업로드)
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tour-images' AND
  auth.role() = 'authenticated'
);

-- tour-gallery 버킷
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'tour-gallery' AND
  auth.role() = 'authenticated'
);
```

#### 삭제 정책 (본인 파일만 삭제)

```sql
-- tour-images 버킷
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- tour-gallery 버킷
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'tour-gallery' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

**Supabase Dashboard에서 설정:**
1. Storage → Policies
2. 각 버킷 선택
3. "New Policy" 클릭
4. 위 SQL을 사용하여 정책 생성

## 🔧 API 사용 방법

### 단일 이미지 업로드

```typescript
const formData = new FormData();
formData.append('file', file); // File 객체
formData.append('type', 'product'); // 'product' or 'gallery'
formData.append('folder', 'tour-images'); // 선택사항

const response = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`, // 인증 토큰 (선택사항)
  },
  body: formData,
});

const data = await response.json();
// { url: "https://...", path: "uploads/user-id/...", name: "image.jpg" }
```

### 여러 이미지 업로드 (갤러리)

```typescript
const formData = new FormData();
files.forEach(file => {
  formData.append('files', file);
});
formData.append('type', 'gallery');

const response = await fetch('/api/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const data = await response.json();
// { files: [{ url: "...", path: "...", name: "..." }, ...], count: 3 }
```

### 파일 삭제

```typescript
const response = await fetch(`/api/upload?path=${encodeURIComponent(filePath)}&bucket=tour-images`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});
```

## 📝 파일 검증 규칙

### Product Images (`tour-images`)
- **최대 크기:** 5 MB
- **허용 타입:** JPEG, JPG, PNG, WebP
- **최대 파일 수:** 10개

### Gallery Images (`tour-gallery`)
- **최대 크기:** 10 MB
- **허용 타입:** JPEG, JPG, PNG, WebP
- **최대 파일 수:** 20개

## 🎯 사용 예시

### React 컴포넌트에서 사용

```typescript
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'product');

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      setImageUrl(data.url);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <p>Uploading...</p>}
      {imageUrl && (
        <img src={imageUrl} alt="Uploaded" className="max-w-xs" />
      )}
    </div>
  );
}
```

### 여러 이미지 업로드

```typescript
const handleMultipleUpload = async (files: FileList) => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('files', file);
  });
  formData.append('type', 'gallery');

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? {
      'Authorization': `Bearer ${token}`,
    } : {},
    body: formData,
  });

  const data = await response.json();
  console.log('Uploaded files:', data.files);
  // data.files: [{ url, path, name }, ...]
};
```

## 🔐 보안 고려사항

### 인증
- 업로드는 인증된 사용자만 가능 (선택사항이지만 권장)
- 삭제는 인증 필수
- 사용자별 폴더로 분리하여 관리

### 파일 검증
- 파일 타입 검증 (MIME type)
- 파일 크기 제한
- 파일명 자동 생성 (타임스탬프 + 랜덤 문자열)

### Storage 정책
- RLS 정책으로 접근 제어
- 사용자는 자신의 파일만 삭제 가능
- 공개 읽기는 모든 사용자 허용

## 📁 파일 구조

업로드된 파일은 다음과 같은 구조로 저장됩니다:

```
bucket/
  └── folder/
      └── user-id/          # 인증된 사용자 ID
          └── timestamp-random.jpg
```

예시:
```
tour-images/
  └── uploads/
      └── 123e4567-e89b-12d3-a456-426614174000/
          └── 1703123456789-abc123def456.jpg
```

## 🐛 문제 해결

### Bucket not found 에러

**문제:** `Bucket not found` 에러 발생

**해결:**
1. Supabase Dashboard → Storage 확인
2. `tour-images` 및 `tour-gallery` 버킷 생성
3. 버킷 이름 정확히 확인

### 업로드 실패

**문제:** 파일 업로드가 실패함

**해결:**
1. 파일 크기 확인 (5MB/10MB 제한)
2. 파일 타입 확인 (JPEG, PNG, WebP만 허용)
3. Storage 정책 확인
4. 인증 토큰 확인

### 권한 오류

**문제:** 403 Forbidden 에러

**해결:**
1. Storage Policies 확인
2. 인증 토큰 확인
3. 사용자 ID 확인

### 공개 URL 접근 불가

**문제:** 업로드된 이미지가 표시되지 않음

**해결:**
1. 버킷이 Public으로 설정되었는지 확인
2. Storage Policies에서 SELECT 정책 확인
3. URL 형식 확인 (`getPublicUrl` 사용)

## ✅ 체크리스트

- [ ] `tour-images` 버킷 생성
- [ ] `tour-gallery` 버킷 생성
- [ ] Storage Policies 설정 (읽기/쓰기/삭제)
- [ ] 버킷 Public 설정 확인
- [ ] 테스트 업로드 실행
- [ ] 업로드된 이미지 접근 확인

---

**다음 단계:**
1. Supabase Storage 버킷 생성
2. Storage Policies 설정
3. 테스트 업로드 실행













