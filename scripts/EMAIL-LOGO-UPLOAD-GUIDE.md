# 이메일 로고 업로드 및 템플릿 적용 가이드

이메일 인증 메일에 사용할 AtoC Korea 로고를 Supabase Storage에 올리고, 생성된 URL이 적용된 HTML을 Supabase 인증 메일 템플릿에 반영하는 방법입니다.

---

## 사전 준비

- 프로젝트 루트에 `.env.local` 파일이 있고, 아래 값이 설정되어 있어야 합니다.
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase 프로젝트 URL
  - `SUPABASE_SERVICE_ROLE_KEY` — 서비스 롤 키 (Storage 업로드용)
- 로고 이미지 파일 1개 (PNG 권장, 예: 검은 배경의 AtoC Korea 풀 로고)

---

## 1단계: Supabase Storage에 버킷 만들기

1. **Supabase 대시보드 접속**  
   https://supabase.com/dashboard 에 로그인 후, 사용 중인 프로젝트를 선택합니다.

2. **Storage 메뉴 이동**  
   왼쪽 사이드바에서 **Storage**를 클릭합니다.

3. **새 버킷 생성**  
   - **New bucket** 버튼을 클릭합니다.  
   - **Name**에 `email-assets` 를 정확히 입력합니다.  
   - **Public bucket** 옵션을 **켜기(체크)** 합니다.  
     - 켜야 이메일에서 로고 이미지 URL로 접근할 수 있습니다.  
   - 필요하면 나머지 설정은 기본값으로 두고 **Create bucket**을 클릭합니다.

4. **확인**  
   Storage 목록에 `email-assets` 버킷이 보이면 완료입니다.

---

## 2단계: 로고 이미지 준비

다음 **둘 중 하나**만 하면 됩니다.

### 방법 A: 프로젝트 안에 로고 넣기 (권장)

1. 프로젝트 폴더에서 `scripts/email-assets/` 폴더를 엽니다.  
   - 없으면 `scripts/email-assets` 폴더를 만들고 그 안에 파일을 넣습니다.
2. 사용할 로고 이미지 파일의 이름을 **`atoc-logo-email.png`** 로 바꾸거나, 이 이름으로 복사해서 `scripts/email-assets/atoc-logo-email.png` 에 저장합니다.  
   - 스크립트는 **경로를 지정하지 않으면** 이 경로의 파일을 사용합니다.

### 방법 B: 다른 위치의 이미지 사용

- 업로드할 이미지의 **전체 경로**를 알고 있으면, 3단계에서 이 경로를 인자로 넘깁니다.  
- 예 (Windows):  
  `C:\Users\sangsong\.cursor\projects\c-Users-sangsong-atockorea\assets\...\파일이름.png`  
- 예 (Mac/Linux):  
  `/Users/.../assets/.../파일이름.png`

---

## 3단계: 스크립트 실행

1. **터미널을 프로젝트 루트에서 연다**  
   - 예: `c:\Users\sangsong\atockorea` (Windows) 또는 `~/atockorea` (Mac/Linux).

2. **실행 방법은 두 가지**  
   - **방법 A를 쓴 경우 (기본 경로)**  
     ```bash
     node scripts/upload-email-logo.js
     ```  
     (Windows PowerShell에서 프로젝트 루트로 이동 후 실행: `cd c:\Users\sangsong\atockorea; node scripts/upload-email-logo.js`)  
   - **방법 B를 쓴 경우 (이미지 경로 지정)**  
     - Windows (PowerShell):  
       ```powershell
       node scripts/upload-email-logo.js "C:\Users\sangsong\.cursor\projects\c-Users-sangsong-atockorea\assets\c__Users_sangsong_AppData_Roaming_Cursor_User_workspaceStorage_d7f7a60c75f798e197ee92aa70fab806_images____________14_-530e271f-d042-4cff-bd65-9a3b14a2d662.png"
       ```  
     - 경로에 공백이 있으면 반드시 큰따옴표로 감싸야 합니다.

3. **정상 실행 시 터미널에 나오는 것**  
   - `📤 Uploading email logo to Supabase Storage...`  
   - `✅ Logo URL: https://xxxxx.supabase.co/storage/v1/object/public/email-assets/atoc-logo-email.png`  
   - `✅ Written: scripts/email-template-confirm-signup.html`  
   - 마지막에 Supabase Dashboard에서 템플릿을 붙여넣으라는 안내가 나옵니다.

4. **에러가 날 때**  
   - **이미지 파일을 찾을 수 없습니다**  
     - 방법 A: `scripts/email-assets/atoc-logo-email.png` 가 있는지 확인.  
     - 방법 B: 인자로 준 경로가 맞는지, 따옴표로 감쌌는지 확인.  
   - **업로드 실패 (Storage 오류)**  
     - 1단계에서 `email-assets` 버킷을 **Public**으로 만들었는지 확인.  
     - `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 올바른지 확인.  
   - **.env.local에 ... 설정하세요**  
     - 프로젝트 루트의 `.env.local`에 위 두 변수가 있는지 확인.

---

## 4단계: 생성된 파일 확인

- 스크립트가 성공하면 **`scripts/email-template-confirm-signup.html`** 파일이 생성되거나 덮어써집니다.
- 이 파일을 열어보면:
  - `img src="https://...supabase.co/.../atoc-logo-email.png"` 처럼 **Logo URL이 이미 들어가 있고**
  - 인증 코드 안내 문구가 **8-digit**로 되어 있으며 (Supabase 호스팅 기준 8자리 발급)
  - 만료 안내가 **3 minutes** (Supabase에서 설정한 180초와 동일)로 되어 있습니다.
  - Supabase 이메일 템플릿 변수 `{{ .Token }}` 이 그대로 있습니다.
- 이 HTML **전체**를 다음 단계에서 Supabase에 붙여넣습니다.

---

## 5단계: Supabase 인증 메일 템플릿에 반영

1. **Supabase 대시보드** → 같은 프로젝트 선택.

2. **Authentication**  
   왼쪽 사이드바에서 **Authentication**을 클릭합니다.

3. **Email Templates**  
   Authentication 메뉴 안에서 **Email Templates** 탭(또는 하위 메뉴)을 엽니다.

4. **수정할 템플릿 선택**  
   - 웹 가입에서 `signInWithOtp()` 로 보내는 인증 메일은 보통 아래 중 하나에 해당합니다.  
   - **Confirm signup** (회원가입 확인)  
   - **Magic Link** (매직 링크 / OTP 메일도 여기 쓸 수 있음)  
   - 프로젝트에서 실제로 어떤 탬플릿을 쓰는지 확인한 뒤, 해당 항목을 클릭해 편집 화면을 엽니다.

5. **HTML 붙여넣기**  
   - `scripts/email-template-confirm-signup.html` 파일을 에디터로 열고 **전체 선택(Ctrl+A / Cmd+A)** 후 **복사**합니다.  
   - Supabase Email Templates 편집 화면의 **HTML 본문**이 보이는 입력란에 **전체 붙여넣기**합니다.  
   - 기존에 Subject 등 다른 필드가 있다면, **Subject는 그대로 두고** 본문(HTML)만 위에서 복사한 내용으로 교체하면 됩니다.

6. **저장**  
   페이지 하단의 **Save** 버튼을 눌러 저장합니다.

이후부터 해당 템플릿을 사용하는 인증 메일에는 Supabase가 Resend 등 SMTP로 발송할 때, 이 HTML이 사용되며 **로고는 Storage의 public URL로 표시**됩니다.

---

## 요약 체크리스트

- [ ] Supabase Storage에 `email-assets` 버킷 생성 (Public)
- [ ] 로고 이미지 준비: `scripts/email-assets/atoc-logo-email.png` 또는 경로 확인
- [ ] 프로젝트 루트에서 `node scripts/upload-email-logo.js` (또는 경로 인자로) 실행
- [ ] `scripts/email-template-confirm-signup.html` 생성 확인
- [ ] Supabase → Authentication → Email Templates → 해당 템플릿에 HTML 전체 붙여넣기 후 저장

---

## 로고를 바꾸고 싶을 때

1. 새 로고 이미지를 `scripts/email-assets/atoc-logo-email.png` 로 교체하거나, 다른 경로에 두고 경로를 인자로 넘깁니다.  
2. 다시 `node scripts/upload-email-logo.js` (또는 경로 지정) 실행합니다.  
3. 같은 URL(`atoc-logo-email.png`)에 덮어쓰기 되므로, **Email Templates에는 수정할 필요 없습니다.**  
   - 브라우저/메일 클라이언트 캐시 때문에 잠시 옛 로고가 보일 수 있으니, 필요하면 캐시 무시 새로고침으로 확인하면 됩니다.
