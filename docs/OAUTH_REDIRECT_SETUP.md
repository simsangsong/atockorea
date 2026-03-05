# OAuth 리다이렉트 설정 (Google / LINE)

휴대폰에서 구글·LINE 로그인 후 "사이트에 접근할 수 없음" 또는 "null" 오류가 나면, **리다이렉트 URL** 설정이 원인인 경우가 많습니다.

## 1. 환경 변수 (필수)

배포 환경(Vercel 등)에서 반드시 설정하세요.

```env
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

- 끝에 `/` 없이 입력 (예: `https://atockorea.com`)
- 이 값이 없으면 로그인 후 리다이렉트가 `localhost` 또는 잘못된 주소로 갈 수 있음

---

## 2. Supabase (Google 로그인)

1. **Supabase Dashboard** → 프로젝트 선택 → **Authentication** → **URL Configuration**
2. 다음을 설정:

   | 항목 | 값 |
   |------|-----|
   | **Site URL** | `https://yourdomain.com` |
   | **Redirect URLs** | 아래 한 줄씩 추가 |

   **Redirect URLs**에 추가할 주소:
   ```
   https://yourdomain.com/auth/callback
   https://yourdomain.com/**
   ```

   개발 중이라면 (선택):
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/**
   ```

3. 저장 후, **Google 로그인**을 다시 시도합니다.

---

## 3. Google Cloud Console (Google 로그인)

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. 사용 중인 **OAuth 2.0 Client ID** (Web application) 선택
3. **Authorized redirect URIs**에 **Supabase**에서 제공하는 콜백 URL을 추가:
   - Supabase **Authentication** → **Providers** → **Google** 에서 확인
   - 형식: `https://<project-ref>.supabase.co/auth/v1/callback`
4. 저장

> ⚠️ 우리 앱의 `/auth/callback`이 아니라, **Supabase의** 콜백 URL을 Google에 등록해야 합니다.

---

## 4. LINE Developers (LINE 로그인)

1. [LINE Developers Console](https://developers.line.biz/console/) → 채널 선택
2. **LINE Login** 탭 → **Callback URL** 설정
3. 다음 URL을 **정확히** 등록 (프로덕션 도메인 기준):

   ```
   https://yourdomain.com/auth/callback?provider=line
   ```

   - `http` / `https`, 쿼리(`?provider=line`)까지 동일해야 함
   - `localhost`로 테스트 시: `http://localhost:3000/auth/callback?provider=line` 추가

4. **Channel ID** / **Channel secret** 을 앱 환경 변수에 설정:
   ```env
   LINE_CHANNEL_ID=...
   LINE_CHANNEL_SECRET=...
   ```

### LINE에서 "Invalid redirect_uri" 400 에러가 날 때

- LINE은 **redirect_uri**를 1글자라도 다르면 400을 냅니다.
- Vercel에 **NEXT_PUBLIC_APP_URL** 을 반드시 설정하세요. (예: `https://atockorea.com` — 끝에 `/` 없이)
- LINE 개발자 콘솔 **Callback URL**에는 아래를 **복사해서 그대로** 한 줄만 넣으세요:
  ```text
  https://atockorea.com/auth/callback?provider=line
  ```
- `www` 사용 중이면 `https://www.atockorea.com/auth/callback?provider=line` 으로 통일하고, 콘솔에도 동일하게 등록하세요.

---

## 5. 코드에서 수정한 내용 (요약)

- **로그인 페이지**: 리다이렉트 기준 주소를 `window.location.origin` 우선으로 사용해, 휴대폰에서도 **현재 접속한 도메인**으로 콜백되도록 변경
- **LINE API**: `NEXT_PUBLIC_APP_URL`이 없을 때 요청의 origin으로 콜백 URL 생성, 기본값 `https://atockorea.com` 사용
- **Auth callback**: `next` 파라미터가 비어 있거나 `"null"` 문자열이어도 `/mypage`로 이동하도록 처리

위 설정을 적용한 뒤에도 오류가 나면, 브라우저 주소창에 표시된 **실제 리다이렉트 URL**을 확인해 보세요.
