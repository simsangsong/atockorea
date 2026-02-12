# Supabase Storage Target Roles 설정 가이드

## 🎯 Target Roles란?

Target roles는 정책이 적용될 사용자 역할을 지정합니다. Supabase에는 여러 기본 역할이 있습니다.

## 📋 사용 가능한 역할 목록

### 기본 역할

1. **`anon`** (익명 사용자)
   - 로그인하지 않은 사용자
   - Public 접근에 사용

2. **`authenticated`** (인증된 사용자)
   - 로그인한 사용자
   - 업로드, 수정, 삭제 권한에 사용

3. **`service_role`** (서비스 역할)
   - 관리자/서버 전용
   - 일반적으로 사용하지 않음

### 시스템 역할 (사용하지 않음)

- `supabase_etl_admin`
- `supabase_read_only_user`
- `supabase_realtime_admin`

이들은 Supabase 내부 시스템 역할이므로 선택하지 마세요.

---

## ✅ 정책별 Target Roles 설정

### 정책 1: Public 읽기 (SELECT)

**Target roles 설정:**
- ✅ **아무것도 선택하지 않음** (기본값 유지)
- 또는 `anon` 선택
- 드롭다운을 열지 않고 그대로 두면 됩니다

**이유:**
- Public 읽기는 모든 사용자에게 허용
- 기본값(public)이 모든 역할에 적용됨
- Policy definition의 `(bucket_id = 'tour-images')`만으로 충분

---

### 정책 2: 인증된 사용자 업로드 (INSERT)

**Target roles 설정:**
- ✅ **`authenticated` 선택**
- 드롭다운 클릭 → `authenticated` 찾아서 클릭
- 체크 표시가 나타나면 선택된 것입니다

**이유:**
- 로그인한 사용자만 업로드 가능
- Policy definition의 `auth.role() = 'authenticated'`와 함께 사용

**선택 방법:**
1. Target roles 드롭다운 클릭
2. 검색창에 "authenticated" 입력 (선택사항)
3. 목록에서 `authenticated` 클릭
4. 체크 표시 확인

---

### 정책 3: 인증된 사용자 업데이트 (UPDATE)

**Target roles 설정:**
- ✅ **`authenticated` 선택**
- 정책 2와 동일하게 설정

---

### 정책 4: 인증된 사용자 삭제 (DELETE)

**Target roles 설정:**
- ✅ **`authenticated` 선택**
- 정책 2와 동일하게 설정

---

## 🔍 Target Roles vs Policy Definition

### 두 가지 방법 비교

**방법 1: Target roles만 사용**
- Target roles: `authenticated` 선택
- Policy definition: `(bucket_id = 'tour-images')`
- ✅ 간단하고 명확

**방법 2: Policy definition에서 제어**
- Target roles: 기본값 유지 (아무것도 선택 안 함)
- Policy definition: `(bucket_id = 'tour-images' AND auth.role() = 'authenticated')`
- ✅ 더 세밀한 제어 가능

**권장 방법:**
- 두 가지를 함께 사용하는 것이 가장 안전합니다
- Target roles: `authenticated` 선택
- Policy definition: `(bucket_id = 'tour-images' AND auth.role() = 'authenticated')`

---

## 📝 설정 요약표

| 정책 | Operation | Target Roles | Policy Definition |
|------|-----------|--------------|-------------------|
| Public 읽기 | SELECT | 기본값 (아무것도 선택 안 함) | `(bucket_id = 'tour-images')` |
| 업로드 | INSERT | `authenticated` 선택 | `(bucket_id = 'tour-images' AND auth.role() = 'authenticated')` |
| 업데이트 | UPDATE | `authenticated` 선택 | `(bucket_id = 'tour-images' AND auth.role() = 'authenticated')` |
| 삭제 | DELETE | `authenticated` 선택 | `(bucket_id = 'tour-images' AND auth.role() = 'authenticated')` |

---

## ⚠️ 주의사항

1. **`service_role`은 선택하지 마세요**
   - 관리자 전용 역할
   - 일반 사용자 정책에는 사용하지 않음

2. **시스템 역할은 선택하지 마세요**
   - `supabase_*`로 시작하는 역할들은 내부 시스템용

3. **Public 읽기는 기본값 유지**
   - 아무것도 선택하지 않으면 모든 사용자에게 적용됨

4. **인증된 사용자 정책은 `authenticated` 선택**
   - 명시적으로 선택하는 것이 더 안전

---

## ✅ 확인 방법

정책을 저장한 후, Policies 목록에서 각 정책을 클릭하여 확인:

1. **Target roles** 섹션 확인
   - Public 읽기: 비어있거나 "public" 표시
   - 인증된 사용자 정책: "authenticated" 표시

2. **Policy definition** 확인
   - 올바른 SQL 조건식인지 확인

---

## 🎯 빠른 참조

**Public 읽기 정책:**
- Target roles: ✅ 기본값 (아무것도 선택 안 함)

**인증된 사용자 정책 (업로드/업데이트/삭제):**
- Target roles: ✅ `authenticated` 선택
- 드롭다운 클릭 → `authenticated` 찾아서 클릭









