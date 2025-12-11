# MyPage 数据表完整检查清单
## MyPage Complete Data Table Checklist

### ✅ 数据表覆盖检查

| MyPage 功能 | 数据表 | 字段 | 状态 |
|------------|--------|------|------|
| **用户头像照片** | `user_profiles.avatar_url` | `avatar_url TEXT` | ✅ |
| **用户姓名** | `user_profiles.full_name` | `full_name TEXT` | ✅ |
| **用户邮箱** | `auth.users.email` | - | ✅ |
| **用户电话** | `user_profiles.phone` | `phone TEXT` | ✅ |
| **出生日期** | `user_profiles.date_of_birth` | `date_of_birth DATE` | ✅ |
| **地址信息** | `user_profiles` | `address, city, province, postal_code, country` | ✅ |
| **时区** | `user_profiles.timezone` | `timezone TEXT` | ✅ |
| **语言偏好** | `user_profiles.language_preference` | `language_preference TEXT` | ✅ |
| **SNS登录信息** | `user_profiles` | `auth_provider, provider_user_id, provider_metadata` | ✅ |
| **Upcoming Tours** | `bookings` + `tours` | `status='confirmed', tour_date >= CURRENT_DATE` | ✅ |
| **My Bookings** | `bookings` + `tours` | 所有订单 | ✅ |
| **Booking History** | `bookings` + `tours` | `status='completed'` | ✅ |
| **Reviews** | `reviews` + `bookings` | 用户评价 | ✅ |
| **Wishlist** | `wishlist` + `tours` | 收藏的产品 | ✅ |
| **Dashboard 统计** | `bookings`, `reviews` | COUNT查询 | ✅ |
| **Recent Activity** | `user_activity_logs` | 活动日志 | ✅ |
| **通知偏好** | `user_settings` | `email_notifications, sms_notifications, etc.` | ✅ |
| **隐私设置** | `user_settings` | `profile_visibility, show_email, etc.` | ✅ |

---

## 📋 详细数据映射

### 1. Dashboard (`/mypage/dashboard`)

#### 需要的数据：

```sql
-- 用户信息
SELECT full_name, avatar_url 
FROM user_profiles 
WHERE id = auth.uid();

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

**数据表：**
- ✅ `user_profiles` - 用户信息
- ✅ `bookings` - 订单统计
- ✅ `reviews` - 评价统计
- ✅ `user_activity_logs` - 活动日志

---

### 2. Upcoming Tours (`/mypage/upcoming`)

#### 需要的数据：

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

**数据表：**
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表

---

### 3. My Bookings (`/mypage/mybookings`)

#### 需要的数据：

```sql
-- Upcoming
SELECT * FROM bookings 
WHERE user_id = auth.uid() 
  AND status = 'confirmed' 
  AND tour_date >= CURRENT_DATE;

-- Completed
SELECT * FROM bookings 
WHERE user_id = auth.uid() 
  AND status = 'completed';

-- Cancelled
SELECT * FROM bookings 
WHERE user_id = auth.uid() 
  AND status = 'cancelled';
```

**数据表：**
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表（JOIN）

---

### 4. Booking History (`/mypage/history`)

#### 需要的数据：

```sql
SELECT 
  b.*,
  t.title,
  t.image_url,
  t.slug
FROM bookings b
JOIN tours t ON t.id = b.tour_id
WHERE b.user_id = auth.uid()
  AND b.status IN ('completed', 'cancelled')
ORDER BY b.tour_date DESC;
```

**数据表：**
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表

---

### 5. Reviews (`/mypage/reviews`)

#### 需要的数据：

```sql
-- 已写的评价
SELECT 
  r.*,
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
  );
```

**数据表：**
- ✅ `reviews` - 评价表
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表

---

### 6. Wishlist (`/mypage/wishlist`)

#### 需要的数据：

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

**数据表：**
- ✅ `wishlist` - 收藏表
- ✅ `tours` - 产品表

---

### 7. Account Settings (`/mypage/settings`)

#### 需要的数据：

#### 7.1 Profile Picture
```sql
SELECT avatar_url FROM user_profiles WHERE id = auth.uid();
UPDATE user_profiles SET avatar_url = '...' WHERE id = auth.uid();
```

#### 7.2 Personal Information
```sql
SELECT 
  full_name,
  phone,
  date_of_birth,
  address,
  city,
  province,
  postal_code,
  country,
  timezone,
  language_preference
FROM user_profiles 
WHERE id = auth.uid();
```

#### 7.3 Preferences
```sql
SELECT 
  language_preference,
  timezone
FROM user_profiles 
WHERE id = auth.uid();
```

#### 7.4 Notification Preferences
```sql
SELECT 
  email_notifications,
  sms_notifications,
  push_notifications,
  marketing_emails,
  booking_reminders,
  promotional_offers
FROM user_settings 
WHERE user_id = auth.uid();
```

#### 7.5 Privacy Settings
```sql
SELECT 
  profile_visibility,
  show_email,
  show_phone,
  allow_messages
FROM user_settings 
WHERE user_id = auth.uid();
```

**数据表：**
- ✅ `user_profiles` - 用户资料表
- ✅ `user_settings` - 用户设置表

---

## 📊 数据表结构总结

### user_profiles 表（已扩展）

```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,              -- 用户姓名
  avatar_url TEXT,             -- 头像照片URL ⭐
  phone TEXT,                  -- 电话
  role TEXT,                   -- 角色
  language_preference TEXT,    -- 语言偏好
  date_of_birth DATE,          -- 出生日期 ⭐
  address TEXT,                 -- 地址 ⭐
  city TEXT,                   -- 城市 ⭐
  province TEXT,               -- 省份 ⭐
  postal_code TEXT,            -- 邮编 ⭐
  country TEXT,                -- 国家 ⭐
  timezone TEXT,               -- 时区 ⭐
  auth_provider TEXT,          -- SNS登录提供商 ⭐
  provider_user_id TEXT,       -- SNS用户ID ⭐
  provider_metadata JSONB,      -- SNS元数据 ⭐
  last_login_method TEXT,      -- 最后登录方式 ⭐
  last_login_at TIMESTAMP,     -- 最后登录时间 ⭐
  linked_accounts JSONB,       -- 关联账户 ⭐
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### user_settings 表（新增）

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE,
  
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
  date_format TEXT,
  
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### user_activity_logs 表（新增）

```sql
CREATE TABLE user_activity_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  action_type TEXT,        -- 'booked', 'reviewed', 'cancelled', etc.
  resource_type TEXT,       -- 'tour', 'booking', 'review', etc.
  resource_id UUID,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP
);
```

---

## ✅ 完整覆盖确认

### 所有 MyPage 功能都已连接数据表：

1. ✅ **用户头像照片** → `user_profiles.avatar_url`
2. ✅ **用户信息** → `user_profiles` (已扩展所有字段)
3. ✅ **Upcoming Tours** → `bookings` + `tours`
4. ✅ **My Bookings** → `bookings` + `tours`
5. ✅ **Booking History** → `bookings` + `tours`
6. ✅ **Reviews** → `reviews` + `bookings`
7. ✅ **Wishlist** → `wishlist` + `tours`
8. ✅ **Dashboard 统计** → `bookings`, `reviews`
9. ✅ **Recent Activity** → `user_activity_logs`
10. ✅ **通知偏好** → `user_settings`
11. ✅ **隐私设置** → `user_settings`
12. ✅ **个人信息扩展** → `user_profiles` (date_of_birth, address, etc.)
13. ✅ **SNS登录信息** → `user_profiles` (auth_provider, etc.)

---

## 🎯 总结

**所有 MyPage 功能的数据表都已完整覆盖！**

- ✅ 18个数据表已创建
- ✅ 所有 MyPage 页面所需的数据都有对应的表
- ✅ 用户头像、个人信息、设置都已支持
- ✅ Upcoming Tours、Bookings、History、Reviews、Wishlist 都已连接
- ✅ Dashboard 统计和 Recent Activity 都已支持

**可以直接执行 `supabase/complete-database-init.sql` 来创建完整的数据库结构！**

---

**最后更新**: 2024年

