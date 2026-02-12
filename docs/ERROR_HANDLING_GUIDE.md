# 에러 처리 가이드

## 📋 개요

AtoCKorea 플랫폼의 통일된 에러 처리 시스템입니다.

## 🎯 원칙

1. **일관성**: 모든 API 라우트에서 동일한 에러 처리 방식 사용
2. **정보성**: 명확한 에러 메시지와 코드 제공
3. **보안**: 프로덕션에서 민감한 정보 노출 방지
4. **로깅**: 모든 에러는 적절히 로깅됨

## 🔧 에러 핸들러 사용

### 기본 사용법

```typescript
import { handleApiError, ErrorResponses, withErrorHandler } from '@/lib/error-handler';

// 방법 1: withErrorHandler 래퍼 사용 (권장)
export const GET = withErrorHandler(async (req: NextRequest) => {
  // 코드 작성
  // 에러가 발생하면 자동으로 처리됨
  return NextResponse.json({ data: 'success' });
});

// 방법 2: try-catch에서 handleApiError 사용
export async function GET(req: NextRequest) {
  try {
    // 코드 작성
    return NextResponse.json({ data: 'success' });
  } catch (error) {
    return handleApiError(error, req);
  }
}
```

### 표준 에러 응답 사용

```typescript
import { ErrorResponses, ErrorCodes } from '@/lib/error-handler';

// 인증 에러
if (!user) {
  return ErrorResponses.unauthorized('Please log in to continue');
}

// 권한 에러
if (user.role !== 'admin') {
  return ErrorResponses.forbidden('Admin access required');
}

// 리소스 없음
if (!tour) {
  return ErrorResponses.notFound('Tour');
}

// 검증 에러
if (!tourId || !bookingDate) {
  return ErrorResponses.validationError('Tour ID and booking date are required');
}

// 충돌
if (bookingExists) {
  return ErrorResponses.conflict('Booking already exists');
}
```

## 📝 에러 코드

### 인증 및 권한

- `UNAUTHORIZED`: 인증 필요
- `FORBIDDEN`: 권한 부족
- `INVALID_TOKEN`: 잘못된 토큰

### 검증

- `VALIDATION_ERROR`: 입력 검증 실패
- `MISSING_FIELD`: 필수 필드 누락
- `INVALID_INPUT`: 잘못된 입력

### 리소스

- `NOT_FOUND`: 리소스 없음
- `ALREADY_EXISTS`: 이미 존재
- `CONFLICT`: 충돌

### 결제

- `PAYMENT_FAILED`: 결제 실패
- `PAYMENT_PROCESSING`: 결제 처리 중

### 예약

- `BOOKING_UNAVAILABLE`: 예약 불가
- `BOOKING_EXPIRED`: 예약 만료

### 시스템

- `INTERNAL_ERROR`: 내부 서버 오류
- `SERVICE_UNAVAILABLE`: 서비스 이용 불가
- `RATE_LIMIT_EXCEEDED`: 요청 제한 초과

## 📊 에러 응답 형식

### 성공 응답

```json
{
  "data": { ... },
  "message": "Success message",
  "success": true,
  "timestamp": "2024-12-14T10:00:00.000Z"
}
```

### 에러 응답

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... },
  "timestamp": "2024-12-14T10:00:00.000Z"
}
```

## 🔄 Supabase 에러 매핑

Supabase 에러 코드는 자동으로 HTTP 상태 코드로 매핑됩니다:

- `23505` (Unique violation) → 409 Conflict
- `23503` (Foreign key violation) → 400 Bad Request
- `23502` (Not null violation) → 400 Bad Request
- `PGRST116` (Not found) → 404 Not Found
- `PGRST301` (Unauthorized) → 401 Unauthorized
- `42501` (Insufficient privilege) → 403 Forbidden

## 💻 예제

### 예제 1: 기본 API 라우트

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withErrorHandler, ErrorResponses } from '@/lib/error-handler';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const supabase = createServerClient();
  const { data: tours, error } = await supabase.from('tours').select('*');

  if (error) {
    throw error; // handleApiError가 자동으로 처리
  }

  return NextResponse.json({ tours });
});
```

### 예제 2: 검증 포함

```typescript
export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = await req.json();
  const { tourId, date, guests } = body;

  // 검증
  if (!tourId) {
    return ErrorResponses.validationError('Tour ID is required');
  }

  if (!date) {
    return ErrorResponses.validationError('Booking date is required');
  }

  if (!guests || guests < 1) {
    return ErrorResponses.validationError('Number of guests must be at least 1', {
      guests: 'Must be a positive number',
    });
  }

  // 비즈니스 로직
  // ...
});
```

### 예제 3: 인증 포함

```typescript
import { getAuthUser, requireRole } from '@/lib/auth';
import { ErrorResponses } from '@/lib/error-handler';

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const user = await requireRole(req, ['admin']);
  
  // user가 없으면 requireRole이 에러를 던지고
  // handleApiError가 자동으로 처리
  // 또는 명시적으로 처리:

  // if (!user) {
  //   return ErrorResponses.unauthorized();
  // }

  // 비즈니스 로직
  // ...
});
```

## 🎨 클라이언트 사이드 에러 처리

### useErrorHandler 훅 사용

```typescript
'use client';

import { useErrorHandler } from '@/lib/hooks/useErrorHandler';

export default function MyComponent() {
  const { handleError, handleAsyncError } = useErrorHandler();

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      const result = await response.json();
      // 성공 처리
    } catch (error) {
      handleError(error, 'Booking creation');
    }
  };

  // 또는 비동기 함수 래핑
  const safeHandleSubmit = async () => {
    const result = await handleAsyncError(async () => {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    }, 'Booking creation');

    if (result) {
      // 성공 처리
    }
  };
}
```

## 📝 마이그레이션 가이드

### 기존 코드 개선

**Before:**
```typescript
export async function GET(req: NextRequest) {
  try {
    // ...
    if (!tour) {
      return NextResponse.json({ error: 'Tour not found' }, { status: 404 });
    }
    return NextResponse.json({ tour });
  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**After:**
```typescript
import { withErrorHandler, ErrorResponses } from '@/lib/error-handler';

export const GET = withErrorHandler(async (req: NextRequest) => {
  // ...
  if (!tour) {
    return ErrorResponses.notFound('Tour');
  }
  return NextResponse.json({ tour });
});
```

## ✅ 체크리스트

API 라우트 작성 시:

- [ ] `withErrorHandler` 또는 `handleApiError` 사용
- [ ] 적절한 에러 코드 사용 (`ErrorResponses`)
- [ ] 검증 에러는 상세 정보 포함
- [ ] 프로덕션에서 스택 트레이스 노출 안 함
- [ ] 모든 에러가 로깅됨

---

**참고:**
- `lib/error-handler.ts`: 에러 핸들러 구현
- `lib/hooks/useErrorHandler.ts`: 클라이언트 사이드 에러 핸들링
- `lib/logger.ts`: 로깅 시스템













