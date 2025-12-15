# 예약 이메일 시스템 가이드

## 📋 개요

예약과 관련된 모든 이메일 발송 시스템입니다.

## 📧 이메일 종류

### 1. 예약 확인 이메일 (Booking Confirmation)

**발송 시점:**
- Deposit 결제 시: 예약 생성 즉시 발송
- Full 결제 시: Stripe 결제 완료 후 (웹훅)
- 관리자가 예약을 'confirmed' 상태로 변경 시

**포함 정보:**
- 예약 ID
- 투어 제목
- 예약 날짜 및 시간
- 인원 수
- 픽업 포인트 (있는 경우)
- 결제 방법
- 총 금액

**함수:** `sendBookingConfirmationEmail()`

### 2. 예약 취소 이메일 (Booking Cancellation)

**발송 시점:**
- 고객 또는 관리자가 예약 취소 시

**포함 정보:**
- 예약 ID
- 취소된 투어 정보
- 환불 가능 여부
- 환불 금액 (해당 시)

**함수:** `sendBookingCancellationEmail()`

### 3. 투어 리마인더 이메일 (Tour Reminder)

**발송 시점:**
- 투어 전날 24시간 전 자동 발송
- Cron Job 또는 스케줄러로 실행

**포함 정보:**
- 투어 정보
- 픽업 시간 및 장소
- 주의사항
- 연락처

**함수:** `sendBookingReminderEmail()`

### 4. 商家 환영 이메일 (Merchant Welcome)

**발송 시점:**
- 관리자가 새로운 商家 계정 생성 시

**포함 정보:**
- 로그인 이메일
- 임시 비밀번호
- 로그인 링크
- 보안 주의사항

**함수:** `sendMerchantWelcomeEmail()`

## 🔄 이메일 발송 플로우

### 예약 생성 플로우

```
1. 고객이 예약 생성
   ↓
2. 예약 데이터 저장 (status: 'pending', payment_status: 'pending')
   ↓
3. 결제 방법 확인
   ├─ Deposit 결제
   │  └─ 즉시 확인 이메일 발송 ✅
   │
   └─ Full 결제
      └─ Stripe Checkout로 이동
         └─ 결제 완료
            └─ Stripe 웹훅 호출
               └─ 상태 업데이트 (status: 'confirmed', payment_status: 'paid')
                  └─ 확인 이메일 발송 ✅
```

### 예약 취소 플로우

```
1. 예약 취소 요청
   ↓
2. 예약 상태 업데이트 (status: 'cancelled')
   ↓
3. 재고 복원
   ↓
4. 취소 이메일 발송 ✅
```

## ⚙️ 설정

### 환경 변수

`.env.local` 및 Vercel 환경 변수:

```env
# Resend (이메일 발송 서비스)
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=AtoCKorea <support@atockorea.com>

# App URL (이메일 링크용)
NEXT_PUBLIC_APP_URL=https://atockorea.com
```

### Resend 설정

1. [Resend Dashboard](https://resend.com)에서 도메인 추가
2. DNS 레코드 설정 (SPF, DKIM)
3. 발신자 이메일 확인

자세한 내용: `docs/RESEND_COMPLETE_SETUP.md`

## 🔧 API 엔드포인트

### 예약 생성 시 이메일

자동으로 발송됩니다:
- `POST /api/bookings` - 예약 생성
- Deposit 결제 시 즉시 발송
- Full 결제 시 Stripe 웹훅에서 발송

### 예약 취소 시 이메일

자동으로 발송됩니다:
- `PUT /api/bookings/[id]` - 예약 상태를 'cancelled'로 변경

### 리마인더 이메일

**수동 실행:**
```bash
GET /api/emails/reminders
```

**자동 실행 (Cron Job):**
Vercel Cron Jobs 또는 외부 스케줄러로 설정:

```json
{
  "crons": [
    {
      "path": "/api/emails/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

매일 오전 9시에 실행되어 다음날 투어 리마인더를 발송합니다.

## 📝 이메일 템플릿

모든 이메일 템플릿은 `lib/email.ts`에 정의되어 있습니다.

### 커스터마이징

이메일 템플릿을 수정하려면 `lib/email.ts` 파일을 편집하세요:

```typescript
// 예약 확인 이메일 HTML 수정
export async function sendBookingConfirmationEmail({ ... }) {
  const html = `
    <!DOCTYPE html>
    <html>
    ...
    <!-- 여기에 원하는 HTML 추가 -->
    ...
    </html>
  `;
  return sendEmail({ to, subject, html });
}
```

## 🧪 테스트

### 개발 환경에서 테스트

개발 환경에서는 이메일이 실제로 발송되지 않을 수 있습니다. Resend가 설정되어 있지 않으면 콘솔에 경고만 출력됩니다.

### 테스트 방법

1. **예약 생성 테스트**
   ```bash
   curl -X POST http://localhost:3000/api/bookings \
     -H "Content-Type: application/json" \
     -d '{
       "tourId": "tour-id",
       "bookingDate": "2024-12-20",
       "numberOfGuests": 2,
       "paymentMethod": "deposit",
       "finalPrice": 50000,
       "customerInfo": {
         "email": "test@example.com",
         "name": "Test User"
       }
     }'
   ```

2. **리마인더 이메일 테스트**
   ```bash
   curl http://localhost:3000/api/emails/reminders
   ```

### Resend Dashboard 확인

1. Resend Dashboard → Emails
2. 발송된 이메일 확인
3. 이메일 내용 및 상태 확인

## 🐛 문제 해결

### 이메일이 발송되지 않음

**원인:**
1. Resend API Key 미설정
2. 도메인 미인증
3. 이메일 주소 오류

**해결:**
1. 환경 변수 확인
2. Resend Dashboard에서 도메인 상태 확인
3. 서버 로그 확인

### 이메일이 스팸으로 분류됨

**해결:**
1. SPF, DKIM 레코드 확인
2. 도메인 평판 확인
3. 이메일 내용 개선 (스팸 키워드 제거)

### 리마인더 이메일이 발송되지 않음

**원인:**
- Cron Job이 설정되지 않음

**해결:**
1. Vercel Cron Jobs 설정
2. 또는 외부 스케줄러 사용 (예: cron-job.org)
3. 수동으로 `/api/emails/reminders` 호출하여 테스트

## ✅ 체크리스트

### 기본 설정
- [ ] Resend 계정 생성
- [ ] 도메인 추가 및 인증
- [ ] 환경 변수 설정
- [ ] 발신자 이메일 확인

### 기능 테스트
- [ ] 예약 확인 이메일 발송 테스트
- [ ] 예약 취소 이메일 발송 테스트
- [ ] 리마인더 이메일 발송 테스트
- [ ] 商家 환영 이메일 발송 테스트

### 자동화
- [ ] Cron Job 설정 (리마인더)
- [ ] 웹훅 설정 (Stripe 결제 완료)

---

**다음 단계:**
1. Resend 설정 완료
2. 각 이메일 유형 테스트
3. Cron Job 설정 (리마인더)

