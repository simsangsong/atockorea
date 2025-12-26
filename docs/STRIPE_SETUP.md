# Stripe 결제 시스템 설정 가이드

## 📋 개요

Stripe를 사용한 결제 시스템이 구현되었습니다. 이 가이드는 Stripe 설정 및 사용 방법을 설명합니다.

## 🔑 환경 변수 설정

### 필수 환경 변수

`.env.local` 파일에 다음 변수들을 추가하세요:

```env
# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# App URL (웹훅 및 리다이렉트용)
NEXT_PUBLIC_APP_URL=https://atockorea.com
```

### Vercel 환경 변수

프로덕션 환경에서는 Vercel Dashboard에서 환경 변수를 설정하세요:

1. Vercel Dashboard → 프로젝트 → Settings → Environment Variables
2. 위의 변수들을 추가
3. 환경 선택: Production, Preview, Development

## 🚀 Stripe 계정 설정

### 1. Stripe 계정 생성

1. [Stripe Dashboard](https://dashboard.stripe.com) 접속
2. 계정 생성 또는 로그인

### 2. API 키 가져오기

1. **개발용 (테스트 모드)**
   - Dashboard → Developers → API keys
   - Test mode toggle 활성화
   - **Secret key** 복사 → `STRIPE_SECRET_KEY`
   - **Publishable key** 복사 → `STRIPE_PUBLISHABLE_KEY` (클라이언트에서 사용, 현재 미사용)

2. **프로덕션용**
   - Test mode toggle 비활성화
   - Live keys 복사
   - ⚠️ 프로덕션에서는 Live keys 사용

### 3. 웹훅 설정

1. Dashboard → Developers → Webhooks
2. "Add endpoint" 클릭
3. Endpoint URL 입력:
   ```
   https://atockorea.com/api/stripe/webhook
   ```
4. Events to listen to 선택:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
5. "Add endpoint" 클릭
6. **Signing secret** 복사 → `STRIPE_WEBHOOK_SECRET` (whsec_로 시작)

### 4. 로컬 개발용 웹훅 테스트

로컬에서 테스트하려면 Stripe CLI 사용:

```bash
# Stripe CLI 설치
# https://stripe.com/docs/stripe-cli

# 로그인
stripe login

# 웹훅 포워딩
stripe listen --forward-to localhost:3000/api/stripe/webhook

# 출력된 webhook signing secret을 .env.local에 추가
# 예: whsec_xxxxxxxxxxxxx
```

## 💳 결제 플로우

### 1. 예약 생성

고객이 예약을 생성하면 `POST /api/bookings`가 호출됩니다.

### 2. Stripe Checkout Session 생성

결제가 필요한 경우 `POST /api/stripe/checkout`를 호출:

```typescript
const response = await fetch('/api/stripe/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 100.00, // USD
    currency: 'usd',
    bookingId: 'booking-uuid',
    bookingData: {
      customerInfo: {
        email: 'customer@example.com',
        name: 'John Doe',
      },
    },
  }),
});

const { url } = await response.json();
// url로 리다이렉트
window.location.href = url;
```

### 3. 결제 완료

Stripe Checkout 페이지에서 결제가 완료되면:

1. 고객이 `success_url`로 리다이렉트됨
2. Stripe가 웹훅으로 `checkout.session.completed` 이벤트 전송
3. 웹훅 핸들러가 예약 상태를 `confirmed`, `paid`로 업데이트
4. 확인 이메일 발송

## 🔄 API 엔드포인트

### POST /api/stripe/checkout

**Request:**
```json
{
  "amount": 100.00,
  "currency": "usd",
  "bookingId": "uuid",
  "bookingData": {
    "customerInfo": {
      "email": "customer@example.com",
      "name": "John Doe"
    }
  }
}
```

**Response:**
```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/...",
  "bookingId": "uuid"
}
```

### POST /api/stripe/webhook

Stripe에서 호출하는 웹훅 엔드포인트입니다. 직접 호출하지 마세요.

## 🧪 테스트

### 테스트 카드 번호

Stripe 테스트 모드에서 사용할 수 있는 카드:

- **성공:** `4242 4242 4242 4242`
- **3D Secure 인증 필요:** `4000 0025 0000 3155`
- **결제 실패:** `4000 0000 0000 0002`

**기타 정보:**
- 만료일: 미래의 아무 날짜 (예: 12/25)
- CVC: 아무 3자리 숫자 (예: 123)
- ZIP: 아무 5자리 숫자 (예: 12345)

### 테스트 플로우

1. 예약 생성
2. 결제 페이지로 이동
3. 테스트 카드 번호 입력
4. 결제 완료
5. 확인 페이지에서 예약 상태 확인
6. Stripe Dashboard에서 결제 확인

## 🐛 문제 해결

### 웹훅 서명 검증 실패

**문제:** `Webhook signature verification failed`

**해결:**
- `STRIPE_WEBHOOK_SECRET` 환경 변수 확인
- 로컬 개발: Stripe CLI에서 출력된 secret 사용
- 프로덕션: Stripe Dashboard의 Webhook signing secret 사용

### 결제 완료 후 상태 업데이트 안 됨

**문제:** 결제는 완료되었지만 예약 상태가 업데이트되지 않음

**해결:**
1. Stripe Dashboard → Webhooks에서 이벤트 로그 확인
2. 웹훅이 전송되었는지 확인
3. 서버 로그에서 에러 확인
4. 데이터베이스 연결 확인

### 금액 불일치

**문제:** 결제 금액이 예약 금액과 다름

**해결:**
- `amount` 파라미터가 올바른지 확인
- USD로 변환 시 환율 고려
- Stripe는 최소 금액 단위(센트) 사용

## 📝 참고 사항

### 지원 통화

현재 기본적으로 USD를 사용합니다. 다른 통화를 사용하려면:

1. Stripe 계정에서 지원하는 통화 확인
2. `currency` 파라미터 변경
3. 금액을 해당 통화의 최소 단위로 변환

### 환불 처리

환불은 별도로 구현해야 합니다:

```typescript
// 환불 API 예시 (구현 필요)
POST /api/stripe/refund
{
  "bookingId": "uuid",
  "amount": 100.00 // 선택사항, 전체 환불 시 생략
}
```

### 부분 결제 (Deposit)

현재는 전체 결제만 지원됩니다. 부분 결제(보증금)를 지원하려면 추가 구현이 필요합니다.

## ✅ 체크리스트

- [ ] Stripe 계정 생성
- [ ] API 키 설정 (테스트 모드)
- [ ] 웹훅 엔드포인트 설정
- [ ] 환경 변수 설정 (.env.local)
- [ ] 테스트 결제 실행
- [ ] 프로덕션 API 키 설정 (배포 시)
- [ ] 프로덕션 웹훅 설정 (배포 시)

---

**다음 단계:**
1. 환경 변수 설정
2. 테스트 결제 실행
3. 프로덕션 배포 시 Live keys로 변경










