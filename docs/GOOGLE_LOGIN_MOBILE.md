# 구글 로그인 리다이렉트 (실제 사용자 / 모바일)

## 실제 사용자(모바일 포함)가 구글 로그인 후 사이트로 돌아오게 하기

코드에서는 **localhost가 아닌 모든 접속**에 대해 리다이렉트 URL을 **실제 사이트 주소**로 고정합니다.

- 사용자가 **실제 서비스**(예: `https://atockorea.com`)에서 로그인하면 → 구글 로그인 후 **항상** `https://atockorea.com/auth/callback` 으로 돌아갑니다.
- `NEXT_PUBLIC_APP_URL` 이 설정되어 있으면 그 값을 사용하고, 없으면 `https://atockorea.com` 을 사용합니다.
- **로컬 개발**(`http://localhost` / `http://127.0.0.1`)에서만 현재 접속한 주소(origin)를 그대로 사용합니다.

이렇게 해서 모바일·PC 구분 없이 **실제 사용자는 항상 배포된 사이트로 리다이렉트**됩니다.

---

## 프로덕션에서 해야 할 설정

### 1. 배포 환경 변수 (권장)

Vercel 등에 다음을 설정하면, 리다이렉트 기준 URL이 명확해집니다.

```env
NEXT_PUBLIC_APP_URL=https://atockorea.com
```

(도메인이 다르면 해당 도메인으로 설정)

### 2. Supabase 리다이렉트 URL

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택  
2. **Authentication** → **URL Configuration** → **Redirect URLs**  
3. 다음 주소 추가:
   - `https://atockorea.com/auth/callback`  
   (실제 사용 중인 도메인으로 변경)

### 3. Google OAuth 리다이렉트 URI

1. [Google Cloud Console](https://console.cloud.google.com/) → 해당 프로젝트  
2. **APIs & Services** → **Credentials** → 사용 중인 **OAuth 2.0 Client ID** (Web application)  
3. **Authorized redirect URIs** 에 추가:
   - `https://atockorea.com/auth/callback`  
   (실제 사용 중인 도메인으로 변경)

위 세 가지가 맞으면 **실제 사용자(모바일 포함)**가 구글 로그인 후 사이트로 정상 리다이렉트됩니다.

---

## 로컬 개발 / 휴대폰 테스트 시

PC에서 `http://localhost:3000` (또는 `http://127.0.0.1:3000`)으로 접속해 로그인하면 리다이렉트는 `http://localhost:3000/auth/callback` (또는 127.0.0.1)로 갑니다.

같은 PC의 개발 서버를 **휴대폰**에서 테스트하려면:

1. PC와 휴대폰이 같은 Wi‑Fi에 연결  
2. PC의 로컬 IP 확인 (예: `ipconfig` → IPv4 주소 `192.168.0.10`)  
3. `.env.local` 에 설정:
   ```env
   NEXT_PUBLIC_APP_URL=http://192.168.0.10:3000
   ```
4. Supabase / Google OAuth에 `http://192.168.0.10:3000/auth/callback` 추가  
5. 휴대폰 브라우저에서 **`http://192.168.0.10:3000`** 으로 접속 후 구글 로그인

이 경우에만 테스트용으로 위 설정을 사용하면 됩니다.
