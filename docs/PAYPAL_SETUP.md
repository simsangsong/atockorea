# PayPal 결제 시스템 설정 가이드

## 📋 개요

PayPal 결제 시스템 통합 및 설정 방법입니다.

## 🔧 설정 단계

### 1. PayPal 개발자 계정 생성

1. **PayPal Developer 계정 생성**
   - [https://developer.paypal.com/](https://developer.paypal.com/) 방문
   - PayPal 계정으로 로그인 또는 새로 생성

2. **샌드박스/라이브 모드**
   - 개발: Sandbox 모드 사용
   - 프로덕션: Live 모드 사용

### 2. PayPal 앱 생성

1. **Dashboard 접속**
   - PayPal Developer Dashboard → My Apps & Credentials

2. **앱 생성**
   - "Create App" 클릭
   - App Name: `AtoCKorea`
   - Select Account: Sandbox 또는 Live 계정 선택
   - Create App 클릭

3. **Client ID 및 Secret 복사**
   - Client ID 복사
   - Secret 복사 (Show 버튼 클릭)

### 3. 웹훅 설정

1. **웹훅 추가**
   - 앱 설정에서 "Webhooks" 섹션
   - "Add Webhook" 클릭
   - Webhook URL: `https://yourdomain.com/api/webhooks/paypal`
   - Event types 선택:
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`

2. **Webhook ID 복사**
   - 생성된 웹훅의 Webhook ID 복사

### 4. 환경 변수 설정

**로컬 개발 (`.env.local`):**

```env
# PayPal 설정
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_SECRET=your_sandbox_secret
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**프로덕션 (Vercel):**

1. Vercel Dashboard → Settings → Environment Variables
2. 다음 변수 추가:
   - `PAYPAL_CLIENT_ID` (Live Client ID)
   - `PAYPAL_SECRET` (Live Secret)
   - `PAYPAL_MODE=live`
   - `PAYPAL_WEBHOOK_ID` (Production Webhook ID)
   - `NEXT_PUBLIC_APP_URL=https://yourdomain.com`

## 📝 API 엔드포인트

### 1. 주문 생성

**POST** `/api/paypal/create-order`

**Request Body:**
```json
{
  "bookingId": "booking-uuid",
  "amount": "100.00",
  "currency": "USD",
  "tourId": "tour-uuid",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe"
}
```

**Response:**
```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "status": "CREATED",
  "links": [
    {
      "href": "https://www.sandbox.paypal.com/checkoutnow?token=...",
      "rel": "approve",
      "method": "GET"
    }
  ]
}
```

### 2. 주문 캡처

**POST** `/api/paypal/capture-order`

**Request Body:**
```json
{
  "orderId": "PAYPAL_ORDER_ID",
  "bookingId": "booking-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "CAPTURE_ID",
  "status": "COMPLETED",
  "details": { ... }
}
```

### 3. 콜백 처리

**GET** `/api/paypal/callback`

PayPal 결제 완료/취소 후 자동 리다이렉트 처리

**Query Parameters:**
- `success=true`: 결제 승인 완료
- `canceled=true`: 결제 취소
- `bookingId`: 예약 ID
- `token`: PayPal Order ID

### 4. 웹훅

**POST** `/api/webhooks/paypal`

PayPal에서 결제 이벤트를 받는 엔드포인트

**처리 이벤트:**
- `PAYMENT.CAPTURE.COMPLETED`: 결제 완료
- `PAYMENT.CAPTURE.DENIED`: 결제 거부
- `PAYMENT.CAPTURE.REFUNDED`: 환불 완료

## 🔄 결제 플로우

```
1. 사용자가 PayPal 결제 선택
   ↓
2. 프론트엔드: POST /api/paypal/create-order
   - 예약 ID, 금액 등 전송
   ↓
3. 서버: PayPal Order 생성
   - PayPal Order ID 반환
   ↓
4. 프론트엔드: PayPal 승인 페이지로 리다이렉트
   - 사용자가 PayPal에서 결제 승인
   ↓
5. PayPal: 승인 후 콜백 URL로 리다이렉트
   - GET /api/paypal/callback?success=true&token=ORDER_ID
   ↓
6. 프론트엔드: 결제 확인 페이지로 리다이렉트
   - POST /api/paypal/capture-order 호출
   ↓
7. 서버: PayPal Order 캡처
   - 예약 상태 'confirmed'로 업데이트
   - 확인 이메일 발송
   ↓
8. (선택) PayPal 웹훅
   - PAYMENT.CAPTURE.COMPLETED 이벤트 수신
   - 추가 처리 (로깅, 알림 등)
```

## 🧪 테스트

### Sandbox 계정 테스트

1. **Sandbox 테스트 계정 생성**
   - PayPal Developer Dashboard → Sandbox → Accounts
   - "Create Account" 클릭
   - Personal 또는 Business 선택

2. **테스트 결제**
   - Sandbox 테스트 계정으로 로그인
   - 테스트 카드 번호 사용:
     - Card: `4032035972634450`
     - CVV: `123`
     - Expiry: 미래 날짜
   - 또는 Sandbox 계정 잔액으로 결제

### 테스트 시나리오

1. **정상 결제**
   - 예약 생성 → PayPal 결제 선택
   - Sandbox 계정으로 결제 승인
   - 예약 상태 확인 (confirmed)
   - 확인 이메일 확인

2. **결제 취소**
   - PayPal 승인 페이지에서 취소
   - 예약 상태 확인 (pending 유지)

3. **웹훅 테스트**
   - PayPal Developer Dashboard → Webhooks
   - 테스트 이벤트 전송
   - 서버 로그 확인

## ⚠️ 주의사항

### 보안

1. **환경 변수 보호**
   - Secret은 절대 클라이언트에 노출 금지
   - Vercel 환경 변수로만 관리

2. **웹훅 검증**
   - 프로덕션에서는 PayPal 웹훅 서명 검증 필수
   - 현재 구현은 기본 검증만 수행

3. **HTTPS 필수**
   - 프로덕션에서는 HTTPS만 사용
   - 웹훅 URL도 HTTPS여야 함

### 환율 처리

- PayPal은 여러 통화 지원
- 현재 구현은 USD 기본
- 한국 원화(KRW) 사용 시 환율 변환 필요

### 에러 처리

- 결제 실패 시 사용자에게 명확한 메시지 표시
- 예약 상태 롤백 고려
- 로깅 및 모니터링 설정

## 🔍 문제 해결

### 결제가 완료되지 않음

1. **환경 변수 확인**
   ```bash
   # 개발 환경
   echo $PAYPAL_CLIENT_ID
   echo $PAYPAL_SECRET
   ```

2. **PayPal 로그 확인**
   - PayPal Developer Dashboard → Logs
   - API 호출 기록 확인

3. **서버 로그 확인**
   ```bash
   # 로컬
   npm run dev
   # 콘솔에서 에러 확인
   ```

### 웹훅이 수신되지 않음

1. **웹훅 URL 확인**
   - 올바른 URL 설정 확인
   - HTTPS 사용 확인

2. **Vercel 환경 확인**
   - 프로덕션 URL이 활성화되어 있는지 확인

3. **로컬 테스트**
   - ngrok 또는 유사한 터널링 서비스 사용
   - 로컬 웹훅 URL을 PayPal에 등록

## ✅ 체크리스트

### 기본 설정
- [ ] PayPal Developer 계정 생성
- [ ] Sandbox 앱 생성
- [ ] Client ID 및 Secret 복사
- [ ] 환경 변수 설정
- [ ] 웹훅 생성 및 Webhook ID 복사

### 기능 테스트
- [ ] 주문 생성 테스트
- [ ] 결제 승인 테스트
- [ ] 주문 캡처 테스트
- [ ] 확인 이메일 발송 테스트
- [ ] 웹훅 수신 테스트

### 프로덕션
- [ ] Live 앱 생성
- [ ] Live 환경 변수 설정
- [ ] 프로덕션 웹훅 설정
- [ ] HTTPS 확인
- [ ] 결제 플로우 종합 테스트

---

**다음 단계:**
1. PayPal Developer 계정 생성 및 설정
2. 환경 변수 구성
3. Sandbox에서 테스트
4. 프로덕션 배포








