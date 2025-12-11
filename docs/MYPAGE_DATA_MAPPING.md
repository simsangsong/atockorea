# MyPage 数据表映射文档
## MyPage Data Table Mapping Documentation

### 📋 概述

本文档详细说明 MyPage 各个功能页面所需的数据表和数据字段。

---

## 🗂️ MyPage 功能页面与数据表映射

### 1. Dashboard (仪表板) - `/mypage/dashboard`

#### 需要的数据：

| 显示内容 | 数据来源 | 查询条件 |
|---------|---------|---------|
| **Welcome back, [用户名]** | `user_profiles.full_name` | `WHERE id = auth.uid()` |
| **Upcoming Tours 数量** | `bookings` | `WHERE user_id = auth.uid() AND status = 'confirmed' AND tour_date >= CURRENT_DATE` |
| **Total Bookings 数量** | `bookings` | `WHERE user_id = auth.uid()` |
| **Reviews 数量** | `reviews` | `WHERE user_id = auth.uid()` |
| **Recent Activity** | `user_activity_logs` | `WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 5` |

#### 数据表：
- ✅ `user_profiles` - 用户信息
- ✅ `bookings` - 订单数据
- ✅ `reviews` - 评价数据
- ✅ `user_activity_logs` - 活动日志（新增）

---

### 2. Upcoming Tours (即将到来的旅游) - `/mypage/upcoming`

#### 需要的数据：

| 显示内容 | 数据来源 | 查询条件 |
|---------|---------|---------|
| **旅游标题** | `tours.title` | JOIN `bookings.tour_id = tours.id` |
| **旅游日期** | `bookings.tour_date` | `WHERE user_id = auth.uid() AND status IN ('confirmed', 'pending') AND tour_date >= CURRENT_DATE` |
| **旅游时间** | `bookings.tour_time` | |
| **状态** | `bookings.status` | |
| **图片** | `tours.image_url` | |

#### 数据表：
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表（JOIN获取产品信息）

#### SQL 查询示例：
```sql
SELECT 
  b.id,
  b.tour_date,
  b.tour_time,
  b.status,
  t.title,
  t.image_url,
  t.slug
FROM bookings b
JOIN tours t ON t.id = b.tour_id
WHERE b.user_id = auth.uid()
  AND b.status IN ('confirmed', 'pending')
  AND b.tour_date >= CURRENT_DATE
ORDER BY b.tour_date ASC;
```

---

### 3. My Bookings (我的预订) - `/mypage/mybookings`

#### 需要的数据：

| 显示内容 | 数据来源 | 查询条件 |
|---------|---------|---------|
| **所有订单** | `bookings` | `WHERE user_id = auth.uid()` |
| **Upcoming** | `bookings` | `WHERE status = 'confirmed' AND tour_date >= CURRENT_DATE` |
| **Completed** | `bookings` | `WHERE status = 'completed'` |
| **Cancelled** | `bookings` | `WHERE status = 'cancelled'` |
| **产品信息** | `tours` | JOIN获取 |
| **取消权限** | `bookings.tour_date` | 计算：`tour_date - CURRENT_DATE > 24小时` |

#### 数据表：
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表

---

### 4. Booking History (预订历史) - `/mypage/history`

#### 需要的数据：

| 显示内容 | 数据来源 | 查询条件 |
|---------|---------|---------|
| **已完成的订单** | `bookings` | `WHERE user_id = auth.uid() AND status = 'completed' ORDER BY tour_date DESC` |
| **已取消的订单** | `bookings` | `WHERE user_id = auth.uid() AND status = 'cancelled'` |

#### 数据表：
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表

---

### 5. Reviews (评价) - `/mypage/reviews`

#### 需要的数据：

| 显示内容 | 数据来源 | 查询条件 |
|---------|---------|---------|
| **已写的评价** | `reviews` | `WHERE user_id = auth.uid() AND is_visible = true` |
| **可以评价的订单** | `bookings` | `WHERE user_id = auth.uid() AND status = 'completed' AND tour_date < CURRENT_DATE AND NOT EXISTS (SELECT 1 FROM reviews WHERE reviews.booking_id = bookings.id)` |

#### 数据表：
- ✅ `reviews` - 评价表
- ✅ `bookings` - 订单表（用于判断哪些订单可以评价）

#### SQL 查询示例：
```sql
-- 已写的评价
SELECT 
  r.id,
  r.rating,
  r.title,
  r.comment,
  r.created_at,
  t.title as tour_title,
  t.slug
FROM reviews r
JOIN tours t ON t.id = r.tour_id
WHERE r.user_id = auth.uid()
  AND r.is_visible = true
ORDER BY r.created_at DESC;

-- 可以评价的订单
SELECT 
  b.id,
  b.tour_date,
  t.title,
  t.slug
FROM bookings b
JOIN tours t ON t.id = b.tour_id
WHERE b.user_id = auth.uid()
  AND b.status = 'completed'
  AND b.tour_date < CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM reviews 
    WHERE reviews.booking_id = b.id
  )
ORDER BY b.tour_date DESC;
```

---

### 6. Wishlist (收藏) - `/mypage/wishlist`

#### 需要的数据：

| 显示内容 | 数据来源 | 查询条件 |
|---------|---------|---------|
| **收藏的产品** | `wishlist` | `WHERE user_id = auth.uid()` |
| **产品信息** | `tours` | JOIN获取 |

#### 数据表：
- ✅ `wishlist` - 收藏表
- ✅ `tours` - 产品表

#### SQL 查询示例：
```sql
SELECT 
  w.id,
  w.created_at,
  t.id as tour_id,
  t.title,
  t.image_url,
  t.price,
  t.slug
FROM wishlist w
JOIN tours t ON t.id = w.tour_id
WHERE w.user_id = auth.uid()
ORDER BY w.created_at DESC;
```

---

### 7. Account Settings (账户设置) - `/mypage/settings`

#### 需要的数据：

#### 7.1 Profile Picture (头像照片)
| 字段 | 数据来源 |
|------|---------|
| **头像URL** | `user_profiles.avatar_url` |

#### 7.2 Personal Information (个人信息)
| 字段 | 数据来源 |
|------|---------|
| **Full Name** | `user_profiles.full_name` |
| **Email** | `auth.users.email` |
| **Phone** | `user_profiles.phone` |
| **Date of Birth** | `user_profiles.date_of_birth` |
| **Address** | `user_profiles.address` |
| **City** | `user_profiles.city` |
| **Country** | `user_profiles.country` |

#### 7.3 Preferences (偏好设置)
| 字段 | 数据来源 |
|------|---------|
| **Language** | `user_profiles.language_preference` |
| **Timezone** | `user_profiles.timezone` |

#### 7.4 Notification Preferences (通知偏好)
| 字段 | 数据来源 |
|------|---------|
| **Email Notifications** | `user_settings.email_notifications` |
| **SMS Notifications** | `user_settings.sms_notifications` |
| **Push Notifications** | `user_settings.push_notifications` |
| **Marketing Emails** | `user_settings.marketing_emails` |
| **Booking Reminders** | `user_settings.booking_reminders` |
| **Promotional Offers** | `user_settings.promotional_offers` |

#### 7.5 Privacy Settings (隐私设置)
| 字段 | 数据来源 |
|------|---------|
| **Profile Visibility** | `user_settings.profile_visibility` |
| **Show Email** | `user_settings.show_email` |
| **Show Phone** | `user_settings.show_phone` |
| **Allow Messages** | `user_settings.allow_messages` |

#### 数据表：
- ✅ `user_profiles` - 用户资料表（已扩展字段）
- ✅ `user_settings` - 用户设置表（新增）
- ✅ `auth.users` - Supabase Auth用户表（用于邮箱）

---

## 📊 数据表字段扩展

### user_profiles 表扩展字段：

```sql
-- 已添加的字段：
date_of_birth DATE,        -- 出生日期
address TEXT,              -- 地址
city TEXT,                 -- 城市
province TEXT,             -- 省份
postal_code TEXT,          -- 邮编
country TEXT,              -- 国家
timezone TEXT,             -- 时区
avatar_url TEXT,           -- 头像照片URL（已存在）
```

### user_settings 表（新增）：

```sql
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  
  -- 通知偏好
  email_notifications BOOLEAN,
  sms_notifications BOOLEAN,
  push_notifications BOOLEAN,
  marketing_emails BOOLEAN,
  booking_reminders BOOLEAN,
  promotional_offers BOOLEAN,
  
  -- 隐私设置
  profile_visibility TEXT,
  show_email BOOLEAN,
  show_phone BOOLEAN,
  allow_messages BOOLEAN,
  
  -- 其他偏好
  currency TEXT,
  date_format TEXT
);
```

### user_activity_logs 表（新增）：

```sql
CREATE TABLE user_activity_logs (
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT,        -- 'booked', 'reviewed', 'cancelled', etc.
  resource_type TEXT,      -- 'tour', 'booking', 'review', etc.
  resource_id UUID,        -- 关联的资源ID
  description TEXT,        -- 活动描述
  metadata JSONB,          -- 额外信息
  created_at TIMESTAMP
);
```

---

## 🔄 数据流程

### Dashboard 数据获取流程：

1. **用户信息** → `user_profiles` 表
2. **统计数据** → 聚合查询：
   - Upcoming Tours: `COUNT(*) FROM bookings WHERE ...`
   - Total Bookings: `COUNT(*) FROM bookings WHERE user_id = ...`
   - Reviews: `COUNT(*) FROM reviews WHERE user_id = ...`
3. **Recent Activity** → `user_activity_logs` 表

### Upcoming Tours 数据获取流程：

1. 查询 `bookings` 表（条件：confirmed/pending + 未来日期）
2. JOIN `tours` 表获取产品信息
3. 返回订单列表

### Settings 数据获取流程：

1. **个人信息** → `user_profiles` 表
2. **设置信息** → `user_settings` 表
3. **头像上传** → Supabase Storage → 更新 `user_profiles.avatar_url`

---

## ✅ 数据表覆盖检查

| MyPage 功能 | 数据表 | 状态 |
|------------|--------|------|
| 用户头像 | `user_profiles.avatar_url` | ✅ |
| 用户信息 | `user_profiles` | ✅ |
| Upcoming Tours | `bookings` + `tours` | ✅ |
| My Bookings | `bookings` + `tours` | ✅ |
| Booking History | `bookings` + `tours` | ✅ |
| Reviews | `reviews` + `bookings` | ✅ |
| Wishlist | `wishlist` + `tours` | ✅ |
| Dashboard 统计 | `bookings`, `reviews` | ✅ |
| Dashboard Activity | `user_activity_logs` | ✅ 新增 |
| 通知偏好 | `user_settings` | ✅ 新增 |
| 隐私设置 | `user_settings` | ✅ 新增 |
| 个人信息扩展 | `user_profiles` | ✅ 已扩展 |

---

## 📝 使用示例

### 获取用户完整信息（包括设置）：

```sql
SELECT 
  up.*,
  us.*,
  u.email
FROM user_profiles up
LEFT JOIN user_settings us ON us.user_id = up.id
LEFT JOIN auth.users u ON u.id = up.id
WHERE up.id = auth.uid();
```

### 获取 Dashboard 数据：

```sql
-- 统计数据
SELECT 
  (SELECT COUNT(*) FROM bookings 
   WHERE user_id = auth.uid() 
   AND status IN ('confirmed', 'pending') 
   AND tour_date >= CURRENT_DATE) as upcoming_tours,
  
  (SELECT COUNT(*) FROM bookings 
   WHERE user_id = auth.uid()) as total_bookings,
  
  (SELECT COUNT(*) FROM reviews 
   WHERE user_id = auth.uid()) as reviews_count;

-- Recent Activity
SELECT 
  action_type,
  resource_type,
  description,
  created_at
FROM user_activity_logs
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

---

**最后更新**: 2024年

