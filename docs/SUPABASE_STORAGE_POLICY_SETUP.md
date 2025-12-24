# Supabase Storage 정책 설정 - 상세 가이드

## 📋 목차
1. [Storage Bucket 생성](#1-storage-bucket-생성)
2. [Storage 정책 설정](#2-storage-정책-설정)
3. [정책별 상세 설정](#3-정책별-상세-설정)
4. [확인 및 테스트](#4-확인-및-테스트)

---

## 1. Storage Bucket 생성

### 1-1. Supabase Dashboard 접속

1. 웹 브라우저에서 **https://supabase.com** 접속
2. 로그인 (이미 로그인되어 있으면 생략)
3. 프로젝트 목록에서 **atockorea** 프로젝트 클릭
   - 또는 해당 프로젝트 이름 클릭

### 1-2. Storage 메뉴 접근

1. 좌측 사이드바에서 **Storage** 아이콘 클릭
   - 📁 폴더 모양 아이콘
   - 또는 "Storage" 텍스트 클릭

### 1-3. `tour-images` Bucket 생성

1. **"New bucket"** 버튼 클릭
   - 우측 상단 또는 중앙에 있는 버튼

2. **Bucket 설정**:
   - **Name**: `tour-images` 입력
     - ⚠️ 정확히 이 이름으로 입력 (대소문자 구분)
     - 공백 없이 하이픈(-) 사용
   - **Public bucket**: ✅ 체크박스 선택
     - 이 옵션이 체크되어야 공개 URL로 접근 가능
   - **File size limit**: `5` MB 입력 (또는 원하는 크기)
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/webp`
     - 각각 입력 후 Enter 또는 추가 버튼 클릭

3. **"Create bucket"** 버튼 클릭
   - 또는 "Save" 버튼

4. ✅ 생성 완료 확인
   - Storage 목록에 `tour-images` bucket이 표시되는지 확인

### 1-4. `tour-gallery` Bucket 생성

1. **"New bucket"** 버튼 다시 클릭

2. **Bucket 설정**:
   - **Name**: `tour-gallery` 입력
   - **Public bucket**: ✅ 체크박스 선택
   - **File size limit**: `10` MB 입력
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/jpg`
     - `image/png`
     - `image/webp`

3. **"Create bucket"** 버튼 클릭

4. ✅ 생성 완료 확인
   - Storage 목록에 `tour-gallery` bucket이 표시되는지 확인

---

## 2. Storage 정책 설정

### 2-1. `tour-images` Bucket 정책 설정

#### 정책 설정 화면 접근

1. Storage 목록에서 **`tour-images`** bucket 클릭
   - bucket 이름을 클릭하면 상세 페이지로 이동

2. 상단 탭에서 **"Policies"** 탭 클릭
   - "Files", "Policies", "Settings" 등 여러 탭 중 "Policies" 선택

3. **"New Policy"** 버튼 클릭
   - 우측 상단 또는 중앙에 있는 버튼

---

## 3. 정책별 상세 설정

### ⚠️ 중요 주의사항

**Policy definition 입력 시:**
- ❌ **잘못된 예**: `1 bucket_id = 'tour-images'` (앞에 숫자 1이 있음)
- ❌ **잘못된 예**: `bucket_id = 'tour-images'` (괄호 없음)
- ✅ **올바른 예**: `(bucket_id = 'tour-images')` (괄호로 감싸야 함)
- 앞에 숫자나 다른 문자를 넣지 마세요!
- 괄호 `()`로 시작하고 끝나야 합니다
- 작은따옴표 `'`로 bucket 이름을 감싸야 합니다

**Allowed operation 선택:**
- 각 정책마다 **하나의 operation만** 선택하는 것을 권장합니다
- SELECT는 UPDATE와 DELETE에 필요하므로 자동으로 체크될 수 있습니다
- 하지만 각 정책의 목적에 맞는 operation만 체크하세요
- 화면에 모든 operation이 체크되어 있어도, 각 정책마다 하나씩만 선택하는 것이 안전합니다

**Target roles:**
- Public 읽기 정책: 기본값 유지 (public)
- 인증된 사용자 정책: "authenticated" 선택 또는 기본값 유지
- Policy definition에서 `auth.role() = 'authenticated'` 조건이 있으면 Target roles는 선택사항입니다

### 정책 1: Public 읽기 권한 (SELECT)

**목적**: 모든 사용자가 이미지를 볼 수 있도록 함

#### 설정 단계:

1. **Policy name** 입력:
   ```
   Public read access
   ```
   - 텍스트 입력 필드에 입력
   - 최대 50자까지 가능 (화면 우측 상단에 "0/50" 표시)

2. **Allowed operation** 선택:
   - ✅ **SELECT** 체크박스만 선택
   - ⚠️ **중요**: INSERT, UPDATE, DELETE는 체크하지 마세요!
   - SELECT만 체크하면 됩니다
   - 참고: "SELECT has been auto selected..." 메시지는 무시해도 됩니다

3. **Target roles** 설정:
   - 드롭다운을 클릭하면 여러 역할이 표시됩니다:
     - `anon` - 익명 사용자
     - `authenticated` - 로그인한 사용자
     - `service_role` - 서비스 역할 (관리자)
     - 기타 시스템 역할들
   - **Public 읽기 정책의 경우**:
     - ✅ **아무것도 선택하지 않고 기본값 유지** (권장)
     - 또는 `anon` 선택
     - "Defaults to all (public) roles if none selected" 메시지가 보이면 그대로 두면 됩니다
   - ⚠️ **주의**: 드롭다운을 열었지만 아무것도 선택하지 않으면 기본값(public)이 적용됩니다

4. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images')
   ```
   - ⚠️ **중요**: 앞에 `1`이나 다른 숫자를 넣지 마세요!
   - 정확히 이 텍스트만 입력: `(bucket_id = 'tour-images')`
   - 괄호와 작은따옴표 포함
   - 코드 에디터 영역에 직접 입력

5. **"Review"** 버튼 클릭
   - 정책을 검토한 후
   - **"Save policy"** 또는 **"Create policy"** 버튼 클릭

6. ✅ 정책 생성 완료 확인
   - Policies 목록에 "Public read access" 정책이 표시되는지 확인

---

### 정책 2: 인증된 사용자 업로드 권한 (INSERT)

**목적**: 로그인한 사용자만 이미지를 업로드할 수 있도록 함

#### 설정 단계:

1. **"New Policy"** 버튼 다시 클릭
   - Policies 탭에서 우측 상단 또는 중앙의 버튼

2. **Policy name** 입력:
   ```
   Authenticated users can upload
   ```

3. **Allowed operation** 선택:
   - ✅ **INSERT** 체크박스만 선택
   - ⚠️ **중요**: 다른 체크박스는 모두 해제
   - SELECT는 자동으로 체크될 수 있지만, INSERT만 체크하면 됩니다

4. **Target roles** 설정:
   - 드롭다운을 클릭
   - 목록에서 **`authenticated`** 찾아서 클릭하여 선택
   - ✅ 체크 표시가 나타나면 선택된 것입니다
   - 또는 기본값 그대로 두고 Policy definition의 `auth.role() = 'authenticated'` 조건으로 제어할 수도 있습니다
   - ⚠️ **참고**: Policy definition에 `auth.role() = 'authenticated'`가 있으면 Target roles는 선택사항이지만, 명시적으로 `authenticated`를 선택하는 것이 더 명확합니다

5. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
   - ⚠️ **중요**: 앞에 `1`이나 다른 숫자를 넣지 마세요!
   - 정확히 이 텍스트만 입력
   - `AND`는 대문자로 작성
   - 작은따옴표 포함

6. **"Review"** 버튼 클릭
   - 검토 후 **"Save policy"** 클릭

7. ✅ 정책 생성 완료 확인

---

### 정책 3: 인증된 사용자 업데이트 권한 (UPDATE)

**목적**: 로그인한 사용자가 이미지를 수정할 수 있도록 함

#### 설정 단계:

1. **"New Policy"** 버튼 다시 클릭

2. **Policy name** 입력:
   ```
   Authenticated users can update
   ```

3. **Allowed operation** 선택:
   - ✅ **UPDATE** 체크박스만 선택
   - SELECT는 자동으로 체크될 수 있습니다 (필요함)

4. **Target roles** 설정:
   - 기본값 유지 또는 "authenticated" 선택

5. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
   - ⚠️ 앞에 숫자나 다른 문자를 넣지 마세요!
   - 괄호로 시작하고 끝나야 합니다

6. **"Review"** 버튼 클릭 후 **"Save policy"** 클릭

7. ✅ 정책 생성 완료 확인

---

### 정책 4: 인증된 사용자 삭제 권한 (DELETE)

**목적**: 로그인한 사용자가 이미지를 삭제할 수 있도록 함

#### 설정 단계:

1. **"New Policy"** 버튼 다시 클릭

2. **Policy name** 입력:
   ```
   Authenticated users can delete
   ```

3. **Allowed operation** 선택:
   - ✅ **DELETE** 체크박스만 선택
   - SELECT는 자동으로 체크될 수 있습니다

4. **Target roles** 설정:
   - 기본값 유지 또는 "authenticated" 선택

5. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
   - ⚠️ 앞에 `1`이나 다른 숫자를 넣지 마세요!
   - 정확히 위 텍스트만 입력

6. **"Review"** 버튼 클릭 후 **"Save policy"** 클릭

7. ✅ 정책 생성 완료 확인

---

### 2-2. `tour-gallery` Bucket 정책 설정

`tour-images`와 동일한 정책을 `tour-gallery`에도 추가해야 합니다.

#### 설정 단계:

1. **Storage 목록으로 돌아가기**
   - 좌측 사이드바에서 **Storage** 클릭
   - 또는 브레드크럼에서 "Storage" 클릭

2. **`tour-gallery` bucket 클릭**

3. **"Policies" 탭 클릭**

4. **동일한 4개 정책 추가**:
   - 정책 1: Public read access
     - Operation: SELECT
     - Policy: `(bucket_id = 'tour-gallery')`
   - 정책 2: Authenticated users can upload
     - Operation: INSERT
     - Policy: `(bucket_id = 'tour-gallery' AND auth.role() = 'authenticated')`
   - 정책 3: Authenticated users can update
     - Operation: UPDATE
     - Policy: `(bucket_id = 'tour-gallery' AND auth.role() = 'authenticated')`
     - Policy: `(bucket_id = 'tour-gallery' AND auth.role() = 'authenticated')`
   - 정책 4: Authenticated users can delete
     - Operation: DELETE
     - Policy: `(bucket_id = 'tour-gallery' AND auth.role() = 'authenticated')`

   ⚠️ **중요**: `tour-images` 대신 `tour-gallery`로 변경해야 합니다!

---

## 4. 확인 및 테스트

### 4-1. Bucket 생성 확인

1. Storage 목록에서 다음 bucket들이 보이는지 확인:
   - ✅ `tour-images`
   - ✅ `tour-gallery`

### 4-2. 정책 확인

각 bucket의 Policies 탭에서 다음 정책들이 모두 있는지 확인:

**`tour-images` bucket:**
- ✅ Public read access (SELECT)
- ✅ Authenticated users can upload (INSERT)
- ✅ Authenticated users can update (UPDATE)
- ✅ Authenticated users can delete (DELETE)

**`tour-gallery` bucket:**
- ✅ Public read access (SELECT)
- ✅ Authenticated users can upload (INSERT)
- ✅ Authenticated users can update (UPDATE)
- ✅ Authenticated users can delete (DELETE)

### 4-3. 실제 테스트

1. **개발 서버 실행 확인**
   ```bash
   npm run dev
   ```

2. **Admin 페이지 접속**
   - http://localhost:3000/admin/products

3. **상품 편집**
   - 상품 목록에서 ✏️ 버튼 클릭

4. **이미지 업로드 테스트**
   - **Images** 탭 클릭
   - **"Upload Thumbnail"** 버튼 클릭
   - 이미지 파일 선택
   - 업로드 진행 확인

5. **성공 확인**
   - ✅ "Uploading..." 메시지가 나타났다가 사라짐
   - ✅ 이미지 미리보기가 표시됨
   - ✅ 오류 메시지가 없음

---

## 🔍 문제 해결

### 문제 1: "Bucket not found" 오류

**증상**: `Storage bucket "tour-images" not found` 오류

**해결**:
1. Storage 목록에서 bucket 이름 확인
2. 정확히 `tour-images`, `tour-gallery`인지 확인 (대소문자 구분)
3. bucket이 없다면 다시 생성

### 문제 2: "new row violates row-level security policy" 오류

**증상**: 업로드는 시작되지만 실패

**해결**:
1. Policies 탭에서 INSERT 정책이 있는지 확인
2. Policy definition이 올바른지 확인
3. Public bucket으로 설정되어 있는지 확인

### 문제 3: 이미지는 업로드되지만 URL이 작동하지 않음

**증상**: 업로드는 성공하지만 이미지가 표시되지 않음

**해결**:
1. Public bucket으로 설정되어 있는지 확인
2. SELECT 정책이 있는지 확인
3. Policy definition이 올바른지 확인

### 문제 4: 정책을 추가할 수 없음

**증상**: "New Policy" 버튼이 비활성화되거나 오류 발생

**해결**:
1. Supabase 프로젝트의 권한 확인
2. 프로젝트 소유자 또는 관리자 권한이 있는지 확인
3. 브라우저 새로고침 후 다시 시도

---

## 📋 최종 체크리스트

### Bucket 생성
- [ ] `tour-images` bucket 생성됨
- [ ] `tour-gallery` bucket 생성됨
- [ ] 두 bucket 모두 Public으로 설정됨
- [ ] File size limit 설정됨
- [ ] MIME types 제한 설정됨

### `tour-images` 정책
- [ ] Public read access (SELECT) 정책 추가됨
- [ ] Authenticated users can upload (INSERT) 정책 추가됨
- [ ] Authenticated users can update (UPDATE) 정책 추가됨
- [ ] Authenticated users can delete (DELETE) 정책 추가됨

### `tour-gallery` 정책
- [ ] Public read access (SELECT) 정책 추가됨
- [ ] Authenticated users can upload (INSERT) 정책 추가됨
- [ ] Authenticated users can update (UPDATE) 정책 추가됨
- [ ] Authenticated users can delete (DELETE) 정책 추가됨

### 테스트
- [ ] 썸네일 이미지 업로드 성공
- [ ] 갤러리 이미지 업로드 성공
- [ ] 업로드된 이미지가 정상적으로 표시됨

---

## ✅ 완료!

모든 설정이 완료되면 이미지 업로드가 정상적으로 작동합니다!

문제가 계속되면 다음을 확인하세요:
1. 브라우저 콘솔 오류 메시지 (F12)
2. Supabase Dashboard의 Storage 로그
3. 개발 서버 터미널의 오류 메시지

