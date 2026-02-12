# 알림 시스템 설정 가이드

## 📋 개요

사용자 알림 시스템입니다. 예약, 결제, 투어 리마인더 등의 이벤트에 대한 알림을 제공합니다.

## 🗄️ 데이터베이스 설정

### 1. 알림 테이블 생성

Supabase SQL Editor에서 실행:

```sql
-- supabase/notifications-schema.sql 파일 실행
```

또는 직접 실행:

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'booking_created',
    'booking_confirmed',
    'booking_cancelled',
    'payment_completed',
    'payment_failed',
    'review_received',
    'tour_reminder',
    'system_announcement',
    'merchant_new_order',
    'merchant_cancellation',
    'admin_alert'
  )),
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- RLS 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id AND is_deleted = false);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
```

## 📝 알림 유형

### 고객 알림

- **booking_created**: 예약 생성 완료
- **booking_confirmed**: 예약 확인 완료
- **booking_cancelled**: 예약 취소
- **payment_completed**: 결제 완료
- **payment_failed**: 결제 실패
- **tour_reminder**: 투어 리마인더 (24시간 전)

### 商家 알림

- **merchant_new_order**: 새 주문 수신
- **merchant_cancellation**: 예약 취소 알림

### 시스템 알림

- **review_received**: 리뷰 수신
- **system_announcement**: 시스템 공지
- **admin_alert**: 관리자 알림

## 🔧 API 엔드포인트

### 1. 알림 목록 조회

**GET** `/api/notifications`

**Query Parameters:**
- `limit`: 반환할 알림 수 (기본값: 50)
- `offset`: 오프셋 (기본값: 0)
- `unreadOnly`: 미읽음만 조회 (`true`/`false`)

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "Booking Confirmed",
      "message": "Your booking for 'Seoul City Tour' has been confirmed.",
      "type": "booking_confirmed",
      "resource_type": "booking",
      "resource_id": "uuid",
      "metadata": {},
      "is_read": false,
      "is_deleted": false,
      "created_at": "2024-12-14T10:00:00Z",
      "read_at": null
    }
  ],
  "unreadCount": 5,
  "total": 10
}
```

### 2. 알림 업데이트 (읽음 처리)

**PATCH** `/api/notifications/[id]`

**Request Body:**
```json
{
  "isRead": true,
  "isDeleted": false
}
```

### 3. 모든 알림 읽음 처리

**PUT** `/api/notifications/mark-all-read`

**Response:**
```json
{
  "success": true
}
```

## 💻 사용 예시

### 알림 생성 (서버 사이드)

```typescript
import { notifyBookingCreated, notifyPaymentCompleted } from '@/lib/notifications';

// 예약 생성 알림
await notifyBookingCreated(bookingId, userId, tourTitle);

// 결제 완료 알림
await notifyPaymentCompleted(bookingId, userId, amount);
```

### 알림 조회 (클라이언트)

```typescript
// 알림 목록 조회
const response = await fetch('/api/notifications?limit=20&unreadOnly=false');
const data = await response.json();
const { notifications, unreadCount } = data;

// 알림 읽음 처리
await fetch(`/api/notifications/${notificationId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ isRead: true }),
});
```

## 🔄 자동 알림 생성

다음 이벤트에서 자동으로 알림이 생성됩니다:

1. **예약 생성**: `app/api/bookings/route.ts`
2. **결제 완료**: `app/api/stripe/webhook/route.ts`, `app/api/paypal/capture-order/route.ts`
3. **예약 취소**: `app/api/bookings/[id]/route.ts`
4. **투어 리마인더**: `app/api/emails/reminders/route.ts` (이메일과 함께)

## 🎨 프론트엔드 구현

### 알림 컴포넌트 예시

```tsx
'use client';

import { useState, useEffect } from 'react';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
    
    // 폴링 (30초마다)
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    const response = await fetch('/api/notifications?limit=10&unreadOnly=true');
    const data = await response.json();
    setUnreadCount(data.unreadCount);
    setNotifications(data.notifications);
  };

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isRead: true }),
    });
    fetchNotifications();
  };

  return (
    <div>
      <button>
        🔔 {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>
      {/* 알림 목록 드롭다운 */}
    </div>
  );
}
```

## 🚀 향후 개선 사항

### 실시간 업데이트

1. **Supabase Realtime 사용**
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
   
   supabase
     .channel('notifications')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'notifications',
       filter: `user_id=eq.${userId}`
     }, (payload) => {
       // 새 알림 처리
     })
     .subscribe();
   ```

2. **Server-Sent Events (SSE)**
   - `/api/notifications/stream` 엔드포인트 구현
   - 클라이언트에서 EventSource 사용

3. **WebSocket**
   - Socket.io 또는 native WebSocket 사용
   - Next.js API Routes에서는 제한적

### 브라우저 푸시 알림

1. **Service Worker 등록**
2. **Push API 사용**
3. **Web Push 라이브러리** (예: `web-push`)

### 앱 푸시 알림

- React Native 앱에서 FCM (Firebase Cloud Messaging) 사용
- Expo Notifications 사용

## ✅ 체크리스트

### 기본 설정
- [ ] 데이터베이스 테이블 생성
- [ ] RLS 정책 설정
- [ ] API 엔드포인트 테스트

### 기능 구현
- [ ] 알림 생성 함수 구현
- [ ] 예약/결제 이벤트에 알림 추가
- [ ] 프론트엔드 알림 UI 구현

### 실시간 기능 (선택)
- [ ] Supabase Realtime 통합
- [ ] 브라우저 푸시 알림
- [ ] 앱 푸시 알림

---

**다음 단계:**
1. 데이터베이스 테이블 생성
2. API 엔드포인트 테스트
3. 프론트엔드 알림 UI 구현
4. 실시간 업데이트 통합













