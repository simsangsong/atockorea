# Stripe 웹훅 로컬 테스트 가이드

로컬 개발 시 Stripe가 `localhost`로 웹훅을 보낼 수 없으므로 **Stripe CLI**로 터널을 뚫어 테스트합니다.

---

## 사전 준비

1. **Stripe CLI 설치**  
   https://stripe.com/docs/stripe-cli  
   (Windows: `scoop install stripe` 또는 공식 설치 파일)

2. **환경 변수**  
   `.env.local`에 다음이 있어야 합니다.
   - `STRIPE_SECRET_KEY` — 결제/세션 생성용
   - `STRIPE_WEBHOOK_SECRET` — **로컬 테스트 시에는 아래에서 출력되는 `whsec_...` 값 사용**

---

## 로컬에서 웹훅 수신

1. **Stripe 로그인**
   ```bash
   stripe login
   ```

2. **로컬 서버 포트로 포워딩**  
   (Next.js 기본 포트 3000)
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

3. **터미널에 출력된 Webhook Signing Secret 복사**  
   `whsec_xxxxxxxxxxxxxxxxxxxxxxxx` 형식입니다.

4. **`.env.local`에 설정**
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
   ```
   로컬 테스트 시에는 이 값을 사용하고, **프로덕션**에서는 Stripe 대시보드 → Developers → Webhooks → 해당 엔드포인트의 Signing secret을 사용합니다.

5. **Next.js 서버 실행**
   ```bash
   npm run dev
   ```

6. **결제 테스트**  
   체크아웃 페이지에서 결제 진행 후, 같은 터미널에서 `checkout.session.completed` 등 이벤트 로그가 보이면 웹훅이 정상 수신된 것입니다.

   **주의:** Stripe 결제 페이지는 **Chrome, Edge, Firefox** 등 일반 브라우저에서 열어야 합니다. Cursor 내장 브라우저는 CSP로 Stripe 인라인 스타일을 막아 결제 폼이 깨지거나 `TypeError`가 날 수 있습니다. 주소창에 `http://localhost:3000`을 입력해 접속한 뒤 예약 → 결제하기 흐름을 진행하세요.

---

## 체크리스트

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` 설정
- [ ] `stripe listen --forward-to localhost:3000/api/stripe/webhook` 실행 중
- [ ] 결제 성공 시 예약 상태 `paid` / `confirmed` 로 변경되는지 DB 확인
- [ ] 예약 확정 메일(Resend) 발송 여부 확인 (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` 설정 필요)
