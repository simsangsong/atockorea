# Paddle 결제 통합 설정 가이드

## 📋 개요

체크아웃 페이지에 Paddle 결제 시스템을 통합했습니다. Paddle은 글로벌 결제 처리 플랫폼으로, 다양한 결제 수단을 지원합니다.

---

## 🔧 설정 단계

### 1. Paddle 계정 설정

1. **Paddle 계정 생성/로그인**
   - [https://vendors.paddle.com](https://vendors.paddle.com) 에서 계정 생성 또는 로그인

2. **Sandbox 환경 설정**
   - 개발 중에는 Sandbox 환경 사용 권장
   - Sandbox에서 테스트 후 Production으로 전환

3. **API 키 생성**
   - Settings > Developer Tools > Authentication
   - API Key 생성 및 저장

4. **제품 및 가격 생성**
   - Products > Add Product
   - 제품 정보 입력
   - Price 생성 (가격, 통화 설정)
   - Product ID와 Price ID 확인

---

### 2. 환경 변수 설정

`.env.local` 파일에 다음 환경 변수를 추가하세요:

```env
# Paddle 설정
PADDLE_API_KEY=your_paddle_api_key
PADDLE_VENDOR_ID=your_paddle_vendor_id
PADDLE_PRODUCT_ID=your_paddle_product_id
PADDLE_PRICE_ID=your_paddle_price_id
PADDLE_PUBLIC_KEY=your_paddle_public_key
PADDLE_ENVIRONMENT=sandbox  # 'sandbox' or 'production'

# 앱 URL (이미 설정되어 있을 수 있음)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**프로덕션 환경 (Vercel):**
- Vercel Dashboard → Settings → Environment Variables
- 위의 환경 변수들을 추가
- `PADDLE_ENVIRONMENT=production`으로 설정

---

### 3. Paddle 웹훅 설정

Paddle에서 웹훅을 설정하여 결제 완료 시 자동으로 주문 상태를 업데이트합니다:

1. **Paddle 대시보드**
   - Settings > Notifications > Webhooks
   - 새 웹훅 추가

2. **웹훅 URL 설정**
   ```
   개발 환경: http://localhost:3000/api/paddle/webhook
   프로덕션: https://yourdomain.com/api/paddle/webhook
   ```

3. **웹훅 이벤트 선택**
   - `transaction.completed`
   - `transaction.payment_succeeded`
   - `transaction.payment_failed` (선택사항)

---

## 🔄 작동 방식

### 결제 플로우

1. **사용자가 체크아웃 페이지에서 결제 버튼 클릭**
   - 예약 정보가 데이터베이스에 저장됨

2. **Paddle.js 초기화**
   - `/api/paddle/checkout` API가 Paddle 설정 반환
   - Paddle.js 스크립트 로드
   - Paddle 체크아웃 오버레이 열기

3. **결제 완료**
   - Paddle에서 결제 완료 후 웹훅 호출
   - `/api/paddle/webhook`이 주문 상태를 "paid"로 업데이트
   - 사용자를 확인 페이지로 리다이렉트

---

## 📝 API 엔드포인트

### POST /api/paddle/checkout

Paddle 체크아웃 설정을 생성합니다.

**Request:**
```json
{
  "amount": 10000,
  "currency": "usd",
  "bookingId": 123,
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
  "url": "https://...",
  "bookingId": 123,
  "paddleConfig": {
    "environment": "sandbox",
    "vendorId": "12345",
    "amount": 10000,
    "currency": "USD",
    "productId": "prod_123",
    "customData": {
      "booking_id": "123",
      "tour_id": "456"
    },
    "customerEmail": "customer@example.com",
    "successUrl": "https://..."
  }
}
```

### POST /api/paddle/webhook

Paddle 웹훅을 처리하여 결제 완료 시 주문 상태를 업데이트합니다.

**Paddle Webhook Payload:**
```json
{
  "event_type": "transaction.completed",
  "data": {
    "id": "txn_123",
    "status": "completed",
    "customer_id": "cus_123",
    "custom_data": {
      "booking_id": "123",
      "tour_id": "456"
    },
    "totals": {
      "total": "100.00"
    },
    "currency_code": "USD"
  }
}
```

---

## 🎨 사용자 인터페이스

체크아웃 페이지에서 Paddle 결제가 자동으로 사용됩니다:

- **Paddle 결제**: 안전하고 빠른 결제 처리
- Paddle.js 오버레이를 통한 원활한 결제 경험

---

## ⚠️ 주의사항

1. **Paddle.js 로드**
   - Paddle.js 스크립트는 동적으로 로드됩니다
   - 첫 결제 시 약간의 지연이 있을 수 있습니다

2. **커스텀 데이터**
   - `passthrough` 필드에 예약 정보 저장
   - 웹훅에서 이 정보를 사용하여 주문 상태 업데이트

3. **환경 설정**
   - 개발 중에는 `PADDLE_ENVIRONMENT=sandbox` 사용
   - 프로덕션에서는 `PADDLE_ENVIRONMENT=production` 사용

4. **테스트**
   - Paddle Sandbox에서 테스트 카드 사용
   - 테스트 카드 번호: Paddle 대시보드에서 확인

---

## 🔍 문제 해결

### Paddle.js가 로드되지 않는 경우
- 환경 변수 `PADDLE_VENDOR_ID` 확인
- 브라우저 콘솔에서 오류 확인
- 네트워크 탭에서 스크립트 로드 확인

### 웹훅이 작동하지 않는 경우
- Paddle 대시보드에서 웹훅 URL 확인
- 서버 로그에서 웹훅 요청 확인
- 커스텀 데이터에 bookingId가 포함되어 있는지 확인

### 결제 완료 후 상태가 업데이트되지 않는 경우
- 웹훅이 제대로 설정되었는지 확인
- `/api/paddle/webhook` 엔드포인트가 접근 가능한지 확인
- 서버 로그에서 오류 확인

---

## 📚 참고 자료

- [Paddle API 문서](https://developer.paddle.com/api-reference/overview)
- [Paddle.js 문서](https://developer.paddle.com/paddlejs/overview)
- [Paddle 웹훅 가이드](https://developer.paddle.com/webhooks/overview)








