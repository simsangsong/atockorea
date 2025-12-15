# Supabase 테이블 연동 상태

## ✅ Supabase Dashboard에 실제로 존재하는 테이블들

### 핵심 비즈니스 테이블 (API에서 사용 중)
1. **`tours`** - 투어 상품 테이블 ✅
   - API에서 사용: `app/api/tours/route.ts`, `app/api/tours/[id]/route.ts`
   - 상태: ✅ Supabase에 존재, ✅ API 연동됨

2. **`pickup_points`** - 픽업 포인트 테이블 ✅
   - API에서 사용: tours API에서 조인하여 가져옴
   - 상태: ✅ Supabase에 존재, ✅ API 연동됨

3. **`bookings`** - 예약 테이블 ✅
   - API에서 사용: `app/api/bookings/route.ts`
   - 상태: ✅ Supabase에 존재, ✅ API 연동됨

4. **`user_profiles`** - 사용자 프로필 테이블 ✅
   - API에서 사용: 인증 관련 API들
   - 상태: ✅ Supabase에 존재, ✅ API 연동됨

5. **`merchants`** - 상인 테이블 ✅
   - API에서 사용: `app/api/admin/merchants/route.ts`
   - 상태: ✅ Supabase에 존재, ✅ API 연동됨

6. **`reviews`** - 리뷰 테이블 ✅
   - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

7. **`wishlist`** - 위시리스트 테이블 ✅
   - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

8. **`cart_items`** - 장바구니 테이블 ✅
   - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

### 관리 및 설정 테이블
9. **`merchant_settings`** - 상인 설정 테이블 ✅
   - 상태: ✅ Supabase에 존재, ✅ API 연동됨

10. **`product_inventory`** - 상품 재고 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

11. **`audit_logs`** - 감사 로그 테이블 ✅
    - 상태: ✅ Supabase에 존재, ✅ API 연동됨

12. **`user_settings`** - 사용자 설정 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

13. **`user_activity_logs`** - 사용자 활동 로그 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

### 이메일 시스템 테이블
14. **`emails`** - 이메일 테이블 ✅
    - 상태: ✅ Supabase에 존재, ✅ API 연동됨 (received_emails로 사용)

### 리뷰 관련 추가 테이블
15. **`review_reactions`** - 리뷰 반응 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

16. **`review_reports`** - 리뷰 신고 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

17. **`review_reports_summary`** - 리뷰 신고 요약 (뷰) ✅
    - 상태: ✅ Supabase에 존재 (UNRESTRICTED), ⚠️ API 미구현

### 정산 시스템 테이블
18. **`settlements`** - 정산 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

19. **`settlement_bookings`** - 정산 예약 연결 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

### 프로모션 테이블
20. **`promo_codes`** - 프로모션 코드 테이블 ✅
    - 상태: ✅ Supabase에 존재, ⚠️ API 미구현

## 🔍 API와 테이블 매핑

| API 엔드포인트 | 사용하는 테이블 | 상태 |
|---------------|----------------|------|
| `GET /api/tours` | `tours`, `pickup_points` | ✅ 연동됨 |
| `GET /api/tours/[id]` | `tours`, `pickup_points` | ✅ 연동됨 |
| `POST /api/bookings` | `bookings`, `tours`, `merchants` | ✅ 연동됨 |
| `GET /api/bookings` | `bookings`, `tours` | ✅ 연동됨 |
| `GET /api/merchant/products` | `tours` | ✅ 연동됨 |
| `GET /api/merchant/orders` | `bookings`, `tours` | ✅ 연동됨 |
| `POST /api/admin/merchants/create` | `user_profiles`, `merchants`, `merchant_settings` | ✅ 연동됨 |

## ⚠️ 확인 필요 사항

### 1. Supabase에 실제로 테이블이 생성되어 있는지 확인

**확인 방법:**
1. Supabase Dashboard 접속
2. 왼쪽 메뉴에서 **Table Editor** 클릭
3. 다음 테이블들이 보이는지 확인:
   - `tours`
   - `pickup_points`
   - `bookings`
   - `user_profiles`
   - `merchants`

### 2. 테이블이 없다면 스키마 실행 필요

**실행 방법:**
1. Supabase Dashboard → **SQL Editor** 클릭
2. **New query** 클릭
3. `supabase/complete-schema.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기
5. **Run** 클릭하여 실행

### 3. RLS (Row Level Security) 정책 확인

스키마 파일에 RLS 정책이 포함되어 있지만, 실제로 활성화되어 있는지 확인 필요:
- Supabase Dashboard → **Authentication** → **Policies**에서 확인

## 📝 다음 단계

1. **테이블 생성 확인**: Supabase Dashboard에서 테이블 존재 여부 확인
2. **테스트 데이터 추가**: `tours` 테이블에 샘플 투어 데이터 추가
3. **API 테스트**: 실제로 API가 작동하는지 테스트

