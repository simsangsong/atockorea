# Supabase Storage 정책 설정 - 빠른 참조 가이드

## 📸 화면별 설정 가이드

### 정책 1: Public 읽기 (SELECT)

**화면 설정:**

1. **Policy name**: 
   ```
   Public read access
   ```

2. **Allowed operation**:
   - ✅ SELECT만 체크
   - ❌ INSERT, UPDATE, DELETE는 체크 해제

3. **Target roles**:
   - 기본값 유지 (public)
   - 또는 드롭다운에서 "public" 선택

4. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images')
   ```
   ⚠️ **주의**: 앞에 `1`이나 다른 숫자를 넣지 마세요!

---

### 정책 2: 인증된 사용자 업로드 (INSERT)

**화면 설정:**

1. **Policy name**: 
   ```
   Authenticated users can upload
   ```

2. **Allowed operation**:
   - ✅ INSERT만 체크
   - SELECT는 자동으로 체크될 수 있음 (괜찮음)
   - ❌ UPDATE, DELETE는 체크 해제

3. **Target roles**:
   - 기본값 유지 또는 "authenticated" 선택

4. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
   ⚠️ **주의**: 
   - 앞에 숫자를 넣지 마세요!
   - `AND`는 대문자로 작성
   - 작은따옴표 포함

---

### 정책 3: 인증된 사용자 업데이트 (UPDATE)

**화면 설정:**

1. **Policy name**: 
   ```
   Authenticated users can update
   ```

2. **Allowed operation**:
   - ✅ UPDATE만 체크
   - SELECT는 자동으로 체크될 수 있음 (필요함)

3. **Target roles**:
   - 기본값 유지 또는 "authenticated" 선택

4. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```

---

### 정책 4: 인증된 사용자 삭제 (DELETE)

**화면 설정:**

1. **Policy name**: 
   ```
   Authenticated users can delete
   ```

2. **Allowed operation**:
   - ✅ DELETE만 체크
   - SELECT는 자동으로 체크될 수 있음 (필요함)

3. **Target roles**:
   - 기본값 유지 또는 "authenticated" 선택

4. **Policy definition**:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```

---

## 🔄 `tour-gallery` Bucket 설정

위와 동일하지만, Policy definition에서 `'tour-images'`를 `'tour-gallery'`로 변경:

- 정책 1: `(bucket_id = 'tour-gallery')`
- 정책 2-4: `(bucket_id = 'tour-gallery' AND auth.role() = 'authenticated')`

---

## ✅ 최종 확인

각 bucket의 Policies 탭에서 다음이 보여야 합니다:

**`tour-images`:**
- Public read access (SELECT)
- Authenticated users can upload (INSERT)
- Authenticated users can update (UPDATE)
- Authenticated users can delete (DELETE)

**`tour-gallery`:**
- Public read access (SELECT)
- Authenticated users can upload (INSERT)
- Authenticated users can update (UPDATE)
- Authenticated users can delete (DELETE)

---

## 🚨 자주 하는 실수

1. ❌ Policy definition 앞에 `1` 입력
   - ✅ 올바른 형식: `(bucket_id = 'tour-images')`

2. ❌ 괄호 없이 입력
   - ✅ 올바른 형식: `(bucket_id = 'tour-images')`

3. ❌ 모든 operation을 한 정책에 체크
   - ✅ 각 정책마다 하나의 operation만 체크

4. ❌ `tour-gallery`에도 `tour-images`로 입력
   - ✅ bucket 이름을 정확히 입력









