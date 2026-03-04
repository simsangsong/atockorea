# Google Cloud Translation API 키 발급 방법 (상세 가이드)

투어 자동 번역 스크립트(`scripts/auto-translate-tours.js`)를 사용하려면 **Google Cloud Translation API** 키가 필요합니다. 아래 순서대로 진행하면 됩니다.

---

## 1. Google Cloud Console 접속

1. 브라우저에서 **https://console.cloud.google.com** 접속
2. 사용할 **Google 계정**으로 로그인
3. 처음 사용하면 약관 동의 화면이 나올 수 있음 → 동의 후 진행

---

## 2. 프로젝트 만들기 (또는 기존 프로젝트 선택)

1. 상단 **프로젝트 선택** 드롭다운 클릭 (현재 프로젝트 이름 옆)
2. **"새 프로젝트"** 클릭
3. **프로젝트 이름** 입력 (예: `atockorea-translation`)
4. **위치**(조직)는 그대로 두거나 필요 시 선택
5. **만들기** 클릭
6. 생성된 프로젝트가 자동으로 선택됨 (안 되면 드롭다운에서 방금 만든 프로젝트 선택)

---

## 3. 결제 계정 연결 (필수)

Translation API는 **무료 할당량**이 있지만, 사용하려면 **결제 계정(청구)** 이 연결되어 있어야 합니다.

1. 왼쪽 메뉴(☰) → **결제** → **결제 계정 관리**
2. **결제 계정 연결** 또는 **새 결제 계정 만들기** 선택
3. 카드 등 결제 수단 등록
4. **무료 할당량**(월 50만자) 내에서는 요금이 청구되지 않음  
   - 초과 시: 약 $20 / 100만자 (자세한 건 Google Cloud 요금표 참고)

---

## 4. Cloud Translation API 사용 설정

1. 왼쪽 메뉴(☰) → **API 및 서비스** → **라이브러리**
2. 검색창에 **"Cloud Translation"** 또는 **"Translate"** 입력
3. **"Cloud Translation API"** (제공: Google) 선택
4. **사용** (또는 Enable) 클릭
5. 활성화 완료될 때까지 잠시 대기

> **참고:** "Translation API (Basic)" 와 "Translation API (Advanced)" 가 있으면,  
> 이 프로젝트에서는 **"Cloud Translation API"** (Basic) 를 사용하면 됩니다.

---

## 5. API 키 만들기

1. 왼쪽 메뉴 → **API 및 서비스** → **사용자 인증 정보**
2. 상단 **+ 사용자 인증 정보 만들기** 클릭
3. **API 키** 선택
4. API 키가 생성되면 **키 복사** 버튼으로 키 값 복사
5. (권장) **키 제한 구성** 클릭 후:
   - **API 제한사항** → "키 제한" 선택
   - "Cloud Translation API" 만 체크
   - 저장
6. **닫기**로 사용자 인증 정보 화면으로 돌아감

---

## 6. 스크립트에 API 키 넣기

1. 프로젝트에서 **`scripts/auto-translate-tours.js`** 파일 열기
2. 상단 설정 부분에서 아래 줄을 찾기:
   ```javascript
   const GOOGLE_TRANSLATE_API_KEY = 'YOUR_GOOGLE_TRANSLATE_API_KEY_HERE';
   ```
3. `'YOUR_GOOGLE_TRANSLATE_API_KEY_HERE'` 를 **복사한 API 키**로 바꾸기:
   ```javascript
   const GOOGLE_TRANSLATE_API_KEY = 'AIzaSy........................';
   ```
4. 파일 저장

---

## 7. 사용 방법 (자동 번역 스크립트)

1. 사이트 **/admin** 에서 로그인
2. 브라우저 **개발자 도구**(F12) → **Console** 탭
3. **`scripts/auto-translate-tours.js`** 파일 내용 **전체 복사** 후 콘솔에 붙여넣기
4. Enter 로 실행
5. 콘솔 로그를 보면서 번역 진행 상황 확인

---

## 문제 해결

### "API key not valid" / 403 에러
- API 키가 올바르게 복사되었는지 확인
- **Cloud Translation API** 가 해당 프로젝트에서 **사용 설정**되어 있는지 확인 (4단계)
- 결제 계정이 연결되어 있는지 확인 (3단계)

### "Billing has not been enabled"
- 결제(청구)가 연결되지 않은 상태입니다. 3단계에서 결제 계정을 연결해야 합니다.
- 무료 한도 내 사용만 해도 결제 계정 등록은 필요합니다.

### API 키 노출이 걱정될 때
- 이 스크립트는 **브라우저 콘솔**에서만 실행되므로, API 키가 클라이언트에 노출됩니다.
- 키 제한(5단계)으로 **Cloud Translation API**만 허용해 두면, 키가 유출돼도 다른 서비스에는 사용할 수 없습니다.
- 서버에서만 번역을 돌리려면 별도로 서버용 스크립트를 두고, API 키는 환경 변수로 관리하는 방식을 권장합니다.

---

## 요약 체크리스트

- [ ] Google Cloud Console 접속 및 로그인
- [ ] 새 프로젝트 생성 (또는 기존 프로젝트 선택)
- [ ] 결제 계정 연결
- [ ] Cloud Translation API 사용 설정
- [ ] 사용자 인증 정보에서 API 키 생성 및 복사
- [ ] `scripts/auto-translate-tours.js` 에 API 키 입력
- [ ] /admin 로그인 후 브라우저 콘솔에서 스크립트 실행

이 순서대로 진행하면 Google Translation API 키를 받아서 자동 번역 스크립트에 사용할 수 있습니다.

---

## 번역이 안 될 때 (상세 설명이 여전히 영어일 때)

사이트 언어를 한국어로 바꿨는데 **상세 설명·일정·포함/불포함** 등이 계속 **영어**로 나오면, DB에 해당 언어 번역이 없는 상태입니다.

### 1. 자동 번역 스크립트 실행

1. **Google Translation API 키**를 발급해 `scripts/auto-translate-tours.js` 상단 `GOOGLE_TRANSLATE_API_KEY` 에 넣었는지 확인
2. **https://localhost:3000/admin** (또는 사용 중인 주소) 에서 **로그인**
3. **F12** → **Console** → `allow pasting` 입력 후 Enter
4. **`scripts/auto-translate-tours.js`** 파일 **전체**를 복사해 콘솔에 붙여넣고 **Enter**
5. 콘솔에 `✅ [투어명] - 번역 완료!` 가 순서대로 나오는지 확인

### 2. "이미 번역이 있습니다" 로만 나와서 스킵될 때

- 스크립트 안에 **`FORCE_RETRANSLATE = true`** 로 바꾼 뒤, 위 3–4번처럼 **다시 실행**
- 그러면 이미 번역이 있는 투어도 **다시 번역**해서 DB를 덮어씁니다

### 3. 그래도 영어로 보일 때

- 브라우저에서 **시크릿/프라이빗 창**으로 열어서 **다시 로그인** 후 투어 페이지 접속
- 또는 **다른 브라우저**에서 접속해 보기 (캐시 제외)
- Supabase **Table Editor** → **tours** → 해당 투어 행 → **translations** 컬럼에 `ko`, `zh` 등이 들어 있는지 확인

### 4. DB에 translations 컬럼이 없을 때

Supabase **SQL Editor**에서 아래 실행:

```sql
ALTER TABLE tours
ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tours_translations
ON tours USING GIN (translations);
```

위 단계를 모두 해도 상세 설명이 영어로만 나오면, 그 투어의 `translations` 에 해당 locale(예: `ko`) 키가 없거나, 스크립트 실행 시 에러가 났을 수 있으니 콘솔 에러 메시지를 확인하면 됩니다.
