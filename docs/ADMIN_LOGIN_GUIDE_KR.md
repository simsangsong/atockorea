# 브라우저에서 Admin 권한 획득하기 - 완전 가이드

## 📋 전체 프로세스 개요

Admin 권한을 획득하려면 **두 가지 단계**가 필요합니다:

1. **Supabase Dashboard에서 사용자 생성** (인증 계정)
2. **SQL Editor에서 Admin 역할 부여** (권한 설정)

그 다음 **브라우저에서 로그인**하여 API를 사용할 수 있습니다.

---

## 🔐 1단계: Supabase Dashboard에서 사용자 생성

### 1.1 Supabase Dashboard 접속

1. **브라우저 열기**
   - Chrome, Firefox, Edge 등 아무 브라우저나 사용 가능
   - **권장: Chrome 또는 Edge**

2. **Supabase Dashboard 접속**
   - 주소창에 입력: `https://supabase.com/dashboard`
   - Enter 키 누르기

3. **로그인**
   - Supabase 계정으로 로그인
   - 계정이 없으면 회원가입 필요

4. **프로젝트 선택**
   - 로그인 후 조직(Organization) 레벨에 있다면:
     - 왼쪽 메뉴에서 **Projects** 클릭
     - 프로젝트 목록에서 **atockorea** (또는 본인의 프로젝트명) 선택
     - 프로젝트 내부로 진입

### 1.2 Authentication 페이지로 이동

1. **왼쪽 메뉴 확인**
   - 프로젝트 내부에 있어야 함
   - 왼쪽 메뉴에 다음 항목들이 보여야 함:
     - Table Editor
     - SQL Editor
     - Database
     - Authentication 🔒
     - Storage
     - 등등...

2. **Authentication 메뉴 클릭**
   - 왼쪽 메뉴에서 **Authentication** (자물쇠 아이콘 🔒) 찾기
   - 보통 **Database**와 **Storage** 사이에 위치
   - 클릭하여 Authentication 페이지로 이동

3. **Users 탭 선택**
   - Authentication 페이지 상단에 탭이 있음
   - **Users** 탭 클릭
   - 현재 사용자 목록이 표시됨 (비어있을 수 있음)

### 1.3 새 사용자 생성

1. **Add user 버튼 클릭**
   - 페이지 우측 상단에 **"Add user"** 또는 **"Create new user"** 버튼
   - 클릭

2. **사용자 정보 입력**
   
   **방식 A: 수동 생성 (권장)**
   
   - **Email**: `admin@atockorea.com` (또는 원하는 이메일)
   - **Password**: 강력한 비밀번호 입력
     - 최소 8자 이상
     - 대소문자, 숫자 포함 권장
     - 예: `Admin123!@#`
   - **Auto Confirm User**: ✅ **반드시 체크!** (중요!)
     - 이 옵션을 체크하지 않으면 이메일 인증이 필요함
   - **Create user** 버튼 클릭

   **방식 B: 초대 링크 (선택사항)**
   - **Invite user** 클릭
   - 이메일 주소 입력
   - 시스템이 초대 이메일 발송

3. **사용자 생성 확인**
   - 성공 메시지 확인
   - 사용자 목록에 새 사용자가 표시됨

### 1.4 사용자 ID 복사

1. **생성된 사용자 찾기**
   - 사용자 목록에서 방금 생성한 사용자 찾기
   - 이메일: `admin@atockorea.com`

2. **사용자 상세 페이지 열기**
   - 사용자 행(row) 클릭
   - 또는 사용자 이메일 클릭

3. **User UID 복사**
   - 사용자 상세 페이지에서 **User UID** 또는 **ID** 찾기
   - UUID 형식 (예: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
   - **복사** (Ctrl+C 또는 우클릭 → 복사)
   - ⚠️ **중요**: 이 ID를 메모장이나 어딘가에 저장해두세요!

---

## 🛠️ 2단계: SQL Editor에서 Admin 역할 부여

### 2.1 SQL Editor 열기

1. **왼쪽 메뉴에서 SQL Editor 찾기**
   - 왼쪽 메뉴에서 **SQL Editor** (아이콘: `>-`) 찾기
   - 클릭

2. **새 쿼리 생성**
   - SQL Editor 페이지에서
   - **"New query"** 또는 **"+ New"** 버튼 클릭
   - 빈 SQL 편집기 창이 열림

### 2.2 SQL 실행하여 Admin 역할 부여

1. **SQL 코드 복사**

```sql
-- 사용자 프로필 생성 및 Admin 역할 부여
-- YOUR_USER_ID를 위에서 복사한 실제 사용자 ID로 교체하세요

INSERT INTO user_profiles (id, full_name, role)
VALUES ('YOUR_USER_ID', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

2. **사용자 ID 교체**
   - `YOUR_USER_ID`를 1.4단계에서 복사한 실제 사용자 ID로 교체
   - 예시:
   ```sql
   INSERT INTO user_profiles (id, full_name, role)
   VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Admin User', 'admin')
   ON CONFLICT (id) DO UPDATE SET role = 'admin';
   ```

3. **SQL 실행**
   - 수정된 SQL을 SQL Editor에 붙여넣기
   - **Run** 버튼 클릭
   - 또는 단축키: `Ctrl + Enter` (Windows) / `Cmd + Enter` (Mac)

4. **결과 확인**
   - 성공 메시지 확인:
     - `Success. No rows returned` 또는
     - `Success. 1 row affected`
   - 에러가 발생하면:
     - 사용자 ID가 올바른지 확인
     - 사용자가 제대로 생성되었는지 확인

### 2.3 Admin 역할 확인 (선택사항)

1. **Table Editor 열기**
   - 왼쪽 메뉴에서 **Table Editor** 클릭
   - **user_profiles** 테이블 선택

2. **Admin 사용자 확인**
   - 테이블에서 방금 생성한 사용자 찾기
   - **id**: 복사한 사용자 ID
   - **full_name**: `Admin User`
   - **role**: `admin` ✅

---

## 🌐 3단계: 브라우저에서 로그인

### 3.1 로컬 개발 서버 실행

1. **터미널 열기**
   - 프로젝트 폴더로 이동
   - 예: `cd C:\Users\sangsong\atockorea`

2. **개발 서버 시작**
   ```bash
   npm run dev
   ```

3. **서버 실행 확인**
   - 터미널에 다음과 같은 메시지 표시:
   ```
   ▲ Next.js 14.2.33
   - Local:        http://localhost:3000
   ```
   - 서버가 실행 중이어야 함

### 3.2 브라우저에서 로그인 페이지 접속

1. **브라우저 열기**
   - Chrome, Firefox, Edge 등 사용 가능
   - **새 탭** 또는 **새 창** 열기

2. **로그인 페이지 접속**
   - 주소창에 입력: `http://localhost:3000/signin`
   - Enter 키 누르기
   - 또는: `http://localhost:3000/admin` (자동으로 로그인 페이지로 리다이렉트될 수 있음)

3. **로그인 페이지 확인**
   - 이메일 입력 필드
   - 비밀번호 입력 필드
   - 로그인 버튼

### 3.3 Admin 계정으로 로그인

1. **이메일 입력**
   - 이메일 필드에 입력: `admin@atockorea.com`
   - (또는 1.3단계에서 생성한 이메일)

2. **비밀번호 입력**
   - 비밀번호 필드에 입력: 1.3단계에서 설정한 비밀번호
   - 예: `Admin123!@#`

3. **로그인 버튼 클릭**
   - **"Sign In"** 또는 **"로그인"** 버튼 클릭

4. **로그인 성공 확인**
   - 로그인 성공 시:
     - `/admin` 페이지로 자동 이동하거나
     - 홈페이지로 이동
   - 브라우저 주소창 확인:
     - `http://localhost:3000/admin` (Admin 대시보드)
     - 또는 `http://localhost:3000` (홈페이지)

### 3.4 Admin 권한 확인

1. **Admin 대시보드 접속**
   - 주소창에 입력: `http://localhost:3000/admin`
   - Enter 키 누르기

2. **Admin 페이지 확인**
   - Admin 대시보드가 표시되면 ✅ 성공!
   - 404 에러가 나오면:
     - 로그인이 제대로 되지 않았을 수 있음
     - 다시 로그인 시도
     - 또는 2단계에서 Admin 역할이 제대로 설정되지 않았을 수 있음

---

## 🎯 4단계: API 사용하기

이제 Admin 권한이 있으므로 API를 사용할 수 있습니다!

### 4.1 브라우저 콘솔 열기

1. **개발자 도구 열기**
   - `F12` 키 누르기
   - 또는: 우클릭 → **"검사"** 또는 **"Inspect"**
   - 또는: `Ctrl + Shift + I` (Windows) / `Cmd + Option + I` (Mac)

2. **Console 탭 선택**
   - 개발자 도구 상단의 탭 중 **Console** 탭 클릭
   - 콘솔 창이 열림

### 4.2 API 호출 스크립트 실행

1. **스크립트 파일 열기**
   - 프로젝트 폴더에서 `scripts/add-jeju-cruise-tour-browser.js` 파일 열기
   - 전체 내용 복사

2. **콘솔에 붙여넣기**
   - 브라우저 콘솔에 붙여넣기 (Ctrl+V)
   - Enter 키 누르기

3. **결과 확인**
   - 콘솔에 다음과 같은 메시지 표시:
   ```
   ✅ 투어 생성 성공! {id: "...", title: "...", ...}
   🌐 투어 확인: /tour/jeju-island-full-day-tour-cruise-passengers
   ```

---

## ⚠️ 문제 해결

### Q1: "Authentication required" 에러가 나요

**A:** 
- 로그인이 제대로 되지 않았을 수 있습니다
- 브라우저 쿠키를 확인하세요
- 다시 로그인해보세요: `http://localhost:3000/signin`

### Q2: "Admin access required" 에러가 나요

**A:**
- Admin 역할이 제대로 설정되지 않았을 수 있습니다
- Supabase Dashboard → Table Editor → user_profiles 테이블 확인
- `role` 필드가 `admin`인지 확인
- 아니면 2단계를 다시 실행하세요

### Q3: 로그인 페이지가 안 나와요

**A:**
- 개발 서버가 실행 중인지 확인: `npm run dev`
- 브라우저 주소가 올바른지 확인: `http://localhost:3000/signin`
- 브라우저 캐시를 지워보세요: `Ctrl + Shift + Delete`

### Q4: 사용자 ID를 못 찾겠어요

**A:**
- Supabase Dashboard → Authentication → Users
- 사용자 목록에서 이메일 클릭
- User UID 또는 ID 필드 확인
- 또는 SQL로 확인:
  ```sql
  SELECT id, email FROM auth.users WHERE email = 'admin@atockorea.com';
  ```

### Q5: SQL 실행이 실패해요

**A:**
- 사용자 ID가 올바른지 확인 (UUID 형식)
- 사용자가 제대로 생성되었는지 확인
- "Auto Confirm User"가 체크되었는지 확인
- 에러 메시지를 자세히 읽어보세요

---

## ✅ 체크리스트

Admin 권한 획득을 위한 체크리스트:

- [ ] Supabase Dashboard에 로그인됨
- [ ] 프로젝트 선택 완료
- [ ] Authentication → Users에서 사용자 생성 완료
- [ ] "Auto Confirm User" 체크됨
- [ ] 사용자 ID (UUID) 복사 완료
- [ ] SQL Editor에서 Admin 역할 부여 SQL 실행 완료
- [ ] SQL 실행 성공 메시지 확인
- [ ] user_profiles 테이블에서 role = 'admin' 확인
- [ ] 로컬 개발 서버 실행 중 (`npm run dev`)
- [ ] 브라우저에서 `http://localhost:3000/signin` 접속 가능
- [ ] Admin 계정으로 로그인 성공
- [ ] `http://localhost:3000/admin` 접속 가능
- [ ] 브라우저 콘솔에서 API 호출 성공

---

## 🎉 완료!

이제 Admin 권한을 획득했으므로:

1. ✅ `/api/admin/tours` API를 사용하여 투어 추가 가능
2. ✅ `/api/admin/merchants` API를 사용하여 상인 관리 가능
3. ✅ Admin 대시보드에서 모든 기능 사용 가능

**다음 단계:**
- `scripts/add-jeju-cruise-tour-browser.js` 파일을 브라우저 콘솔에서 실행하여 제주 크루즈 투어 추가!

---

## 📚 관련 문서

- `docs/CREATE_ADMIN_STEP_BY_STEP.md` - Admin 생성 상세 가이드 (중국어)
- `docs/TOUR_API_COMPLETE_GUIDE.md` - 투어 API 완전 가이드
- `docs/ACCESS_GUIDE.md` - 접근 가이드
