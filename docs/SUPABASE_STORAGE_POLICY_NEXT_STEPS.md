# Supabase Storage 정책 설정 - 다음 단계

## ✅ 1단계 완료 확인

현재 "Public read access" 정책이 생성되었습니다!

Policies 목록에 다음이 보여야 합니다:
- ✅ `Public read access ur7pfx_0` (또는 유사한 이름)

---

## 📝 2단계: 나머지 3개 정책 추가

이제 `tour-images` bucket에 나머지 3개 정책을 추가해야 합니다.

### 정책 2: 인증된 사용자 업로드 (INSERT)

1. **"New Policy"** 버튼 클릭
   - Policies 목록 위쪽에 있는 버튼

2. **Policy name** 입력:
   ```
   Authenticated users can upload
   ```

3. **Allowed operation**:
   - ✅ **INSERT** 체크박스만 선택
   - SELECT는 자동으로 체크될 수 있음 (괜찮음)
   - ❌ UPDATE, DELETE는 체크 해제

4. **Target roles**:
   - 드롭다운 클릭
   - 목록에서 **`authenticated`** 선택
   - 체크 표시 확인

5. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```
   ⚠️ 앞에 숫자를 넣지 마세요! 괄호로 시작해야 합니다.

6. **"Review"** 버튼 클릭
7. **"Save policy"** 또는 **"Create policy"** 클릭

8. ✅ Policies 목록에 추가되었는지 확인

---

### 정책 3: 인증된 사용자 업데이트 (UPDATE)

1. **"New Policy"** 버튼 클릭

2. **Policy name** 입력:
   ```
   Authenticated users can update
   ```

3. **Allowed operation**:
   - ✅ **UPDATE** 체크박스만 선택
   - SELECT는 자동으로 체크될 수 있음

4. **Target roles**:
   - **`authenticated`** 선택

5. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```

6. **"Review"** → **"Save policy"** 클릭

7. ✅ Policies 목록에 추가되었는지 확인

---

### 정책 4: 인증된 사용자 삭제 (DELETE)

1. **"New Policy"** 버튼 클릭

2. **Policy name** 입력:
   ```
   Authenticated users can delete
   ```

3. **Allowed operation**:
   - ✅ **DELETE** 체크박스만 선택
   - SELECT는 자동으로 체크될 수 있음

4. **Target roles**:
   - **`authenticated`** 선택

5. **Policy definition** 입력:
   ```sql
   (bucket_id = 'tour-images' AND auth.role() = 'authenticated')
   ```

6. **"Review"** → **"Save policy"** 클릭

7. ✅ Policies 목록에 추가되었는지 확인

---

## ✅ `tour-images` Bucket 완료 확인

Policies 목록에 다음 4개 정책이 모두 보여야 합니다:

1. ✅ Public read access (SELECT)
2. ✅ Authenticated users can upload (INSERT)
3. ✅ Authenticated users can update (UPDATE)
4. ✅ Authenticated users can delete (DELETE)

---

## 🔄 3단계: `tour-gallery` Bucket 정책 설정

`tour-images`와 동일한 4개 정책을 `tour-gallery`에도 추가해야 합니다.

### `tour-gallery` Bucket으로 이동

1. 좌측 사이드바에서 **Storage** 클릭
2. Storage 목록에서 **`tour-gallery`** bucket 클릭
3. **"Policies"** 탭 클릭

### 동일한 4개 정책 추가

`tour-images`와 동일하게 4개 정책을 추가하되, **Policy definition에서 bucket 이름만 변경**:

- 정책 1: `(bucket_id = 'tour-gallery')`
- 정책 2-4: `(bucket_id = 'tour-gallery' AND auth.role() = 'authenticated')`

---

## 📋 최종 체크리스트

### `tour-images` Bucket
- [ ] Public read access (SELECT) ✅ 완료
- [ ] Authenticated users can upload (INSERT)
- [ ] Authenticated users can update (UPDATE)
- [ ] Authenticated users can delete (DELETE)

### `tour-gallery` Bucket
- [ ] Public read access (SELECT)
- [ ] Authenticated users can upload (INSERT)
- [ ] Authenticated users can update (UPDATE)
- [ ] Authenticated users can delete (DELETE)

---

## 🎯 다음 단계

모든 정책을 추가한 후:

1. **개발 서버 확인**
   - 이미 실행 중이면 그대로 사용
   - 아니면 `npm run dev` 실행

2. **이미지 업로드 테스트**
   - Admin 페이지 → 상품 편집 → Images 탭
   - 이미지 업로드 시도
   - 오류가 없으면 성공!

---

## 💡 팁

- 각 정책을 하나씩 추가하는 것이 안전합니다
- 정책을 추가한 후 Policies 목록에서 확인하세요
- 정책 이름은 나중에 변경할 수 있습니다
- Policy definition은 정확히 입력해야 합니다

