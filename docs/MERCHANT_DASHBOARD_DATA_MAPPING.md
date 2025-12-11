# 商家端 Dashboard 数据表映射文档
## Merchant Dashboard Data Table Mapping Documentation

### 📋 概述

本文档详细说明商家端所有功能页面所需的数据表和数据字段。

---

## 🗂️ 商家端功能页面与数据表映射

### 1. Dashboard (商家仪表板) - `/merchant`

#### 需要的数据：

| 显示内容 | 数据来源 | SQL查询 |
|---------|---------|---------|
| **오늘 주문 (今天订单)** | `bookings` | `COUNT(*) WHERE merchant_id = ? AND DATE(booking_date) = CURRENT_DATE` |
| **대기 (待处理订单)** | `bookings` | `COUNT(*) WHERE merchant_id = ? AND status = 'pending'` |
| **내 상품 (我的产品)** | `tours` | `COUNT(*) WHERE merchant_id = ?` |
| **판매중 (销售中产品)** | `tours` | `COUNT(*) WHERE merchant_id = ? AND is_active = true` |
| **오늘 매출 (今天收入)** | `bookings` | `SUM(final_price) WHERE merchant_id = ? AND DATE(booking_date) = CURRENT_DATE` |
| **총 매출 (总收入)** | `bookings` | `SUM(final_price) WHERE merchant_id = ?` |
| **정산 대기 (待结算金额)** | `bookings` | `SUM(扣除10%手续费后) WHERE payment_status = 'paid' AND settlement_status = 'pending'` |
| **정산 완료 (已结算金额)** | `bookings` | `SUM(扣除10%手续费后) WHERE settlement_status = 'settled'` |
| **최근 주문 (最近订单)** | `bookings` | `SELECT * WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 5` |

#### 数据表：
- ✅ `merchants` - 商家信息
- ✅ `tours` - 产品数据
- ✅ `bookings` - 订单数据

#### SQL 查询示例：
```sql
-- Dashboard 统计数据
SELECT 
  -- 今天订单数
  (SELECT COUNT(*) FROM bookings 
   WHERE merchant_id = ? AND DATE(booking_date) = CURRENT_DATE) as today_orders,
  
  -- 待处理订单数
  (SELECT COUNT(*) FROM bookings 
   WHERE merchant_id = ? AND status = 'pending') as pending_orders,
  
  -- 总产品数
  (SELECT COUNT(*) FROM tours 
   WHERE merchant_id = ?) as total_products,
  
  -- 活跃产品数
  (SELECT COUNT(*) FROM tours 
   WHERE merchant_id = ? AND is_active = true) as active_products,
  
  -- 今天收入
  (SELECT COALESCE(SUM(final_price), 0) FROM bookings 
   WHERE merchant_id = ? AND DATE(booking_date) = CURRENT_DATE) as today_revenue,
  
  -- 总收入
  (SELECT COALESCE(SUM(final_price), 0) FROM bookings 
   WHERE merchant_id = ?) as total_revenue,
  
  -- 待结算金额（扣除10%手续费后）
  (SELECT COALESCE(SUM(final_price * 0.9), 0) FROM bookings 
   WHERE merchant_id = ? 
   AND payment_status = 'paid' 
   AND settlement_status = 'pending') as pending_settlement,
  
  -- 已结算金额（扣除10%手续费后）
  (SELECT COALESCE(SUM(final_price * 0.9), 0) FROM bookings 
   WHERE merchant_id = ? 
   AND settlement_status = 'settled') as settled_revenue;

-- 最近订单
SELECT 
  b.id,
  b.booking_date,
  b.final_price,
  b.status,
  b.number_of_guests,
  t.title
FROM bookings b
JOIN tours t ON t.id = b.tour_id
WHERE b.merchant_id = ?
ORDER BY b.created_at DESC
LIMIT 5;
```

---

### 2. Revenue (收入明细) - `/merchant/revenue`

#### 需要的数据：

| 显示内容 | 数据来源 | SQL查询 |
|---------|---------|---------|
| **总支付金额** | `bookings.final_price` | `SUM(final_price)` |
| **平台手续费 (10%)** | 计算 | `SUM(final_price) * 0.1` |
| **实际应收金额** | 计算 | `SUM(final_price) * 0.9` |
| **待结算金额** | `bookings` | `WHERE payment_status = 'paid' AND settlement_status = 'pending'` |
| **已结算金额** | `bookings` | `WHERE settlement_status = 'settled'` |
| **付后结余** | 计算 | `实际应收 - 已结算` |
| **收入明细列表** | `bookings` + `tours` | JOIN查询 |

#### 数据表：
- ✅ `bookings` - 订单表（包含 settlement_status）
- ✅ `tours` - 产品表（JOIN获取产品名称）

#### 已实现的API：
- ✅ `/api/merchant/revenue` - 已实现，包含所有计算逻辑

---

### 3. Products (产品管理) - `/merchant/products`

#### 需要的数据：

| 显示内容 | 数据来源 | SQL查询 |
|---------|---------|---------|
| **产品列表** | `tours` | `SELECT * WHERE merchant_id = ?` |
| **产品状态** | `tours.is_active` | 上架/下架 |
| **产品信息** | `tours` | title, city, price, created_at |

#### 数据表：
- ✅ `tours` - 产品表（包含所有产品字段）

#### 已实现的API：
- ✅ `GET /api/merchant/products` - 获取产品列表
- ✅ `POST /api/merchant/products` - 创建新产品

#### 需要的额外功能：
- ⚠️ `PATCH /api/merchant/products` - 更新产品（需要添加）
- ⚠️ `DELETE /api/merchant/products` - 删除产品（需要添加）

---

### 4. Orders (订单管理) - `/merchant/orders`

#### 需要的数据：

| 显示内容 | 数据来源 | SQL查询 |
|---------|---------|---------|
| **订单列表** | `bookings` + `tours` | `SELECT * WHERE merchant_id = ?` |
| **订单状态筛选** | `bookings.status` | pending/confirmed/completed/cancelled |
| **订单详情** | `bookings` | 所有订单字段 |
| **客户信息** | `bookings` | contact_name, contact_email, contact_phone |
| **产品信息** | `tours` | title, city |

#### 数据表：
- ✅ `bookings` - 订单表（包含所有订单字段）
- ✅ `tours` - 产品表（JOIN）

#### 已实现的API：
- ✅ `GET /api/merchant/orders` - 获取订单列表
- ✅ `PATCH /api/merchant/orders` - 更新订单状态

---

### 5. Analytics (数据分析) - `/merchant/analytics`

#### 需要的数据：

| 显示内容 | 数据来源 | SQL查询 |
|---------|---------|---------|
| **总营收** | `bookings` | `SUM(final_price) WHERE merchant_id = ?` |
| **总订单数** | `bookings` | `COUNT(*) WHERE merchant_id = ?` |
| **平均订单金额** | `bookings` | `AVG(final_price) WHERE merchant_id = ?` |
| **热门产品** | `bookings` + `tours` | `GROUP BY tour_id ORDER BY COUNT(*) DESC` |
| **销售趋势** | `bookings` | `GROUP BY DATE(booking_date) ORDER BY date` |

#### 数据表：
- ✅ `bookings` - 订单表
- ✅ `tours` - 产品表

#### SQL 查询示例：
```sql
-- 热门产品
SELECT 
  t.id,
  t.title,
  COUNT(b.id) as order_count,
  SUM(b.final_price) as revenue
FROM tours t
LEFT JOIN bookings b ON b.tour_id = t.id
WHERE t.merchant_id = ?
GROUP BY t.id, t.title
ORDER BY order_count DESC
LIMIT 10;

-- 销售趋势（按日期）
SELECT 
  DATE(booking_date) as date,
  COUNT(*) as order_count,
  SUM(final_price) as revenue
FROM bookings
WHERE merchant_id = ?
GROUP BY DATE(booking_date)
ORDER BY date DESC
LIMIT 30;
```

#### 需要的API：
- ⚠️ `GET /api/merchant/analytics` - 需要创建

---

### 6. Settings (设置) - `/merchant/settings`

#### 需要的数据：

#### 6.1 商家信息
| 字段 | 数据来源 |
|------|---------|
| **公司名称** | `merchants.company_name` |
| **联系邮箱** | `merchants.contact_email` |
| **联系电话** | `merchants.contact_phone` |

#### 6.2 通知设置
| 字段 | 数据来源 |
|------|---------|
| **邮件通知** | `merchant_settings.email_notifications_enabled` |
| **短信通知** | `merchant_settings.sms_notifications_enabled` |
| **自动确认订单** | `merchant_settings.auto_confirm_orders` |

#### 6.3 银行账户信息
| 字段 | 数据来源 |
|------|---------|
| **银行名称** | `merchants.bank_name` |
| **账户号码** | `merchants.bank_account_number` |
| **账户持有人** | `merchants.account_holder_name` |

#### 数据表：
- ✅ `merchants` - 商家表
- ✅ `merchant_settings` - 商家设置表

#### 需要的API：
- ⚠️ `GET /api/merchant/settings` - 需要创建
- ⚠️ `PATCH /api/merchant/settings` - 需要创建

---

### 7. Customers (客户管理) - `/merchant/customers`

#### 需要的数据：

| 显示内容 | 数据来源 | SQL查询 |
|---------|---------|---------|
| **客户列表** | `bookings` + `auth.users` | 通过订单获取客户信息 |
| **客户订单数** | `bookings` | `COUNT(*) GROUP BY user_id` |
| **客户总消费** | `bookings` | `SUM(final_price) GROUP BY user_id` |
| **客户信息** | `user_profiles` | full_name, email, phone |

#### 数据表：
- ✅ `bookings` - 订单表（包含 user_id）
- ✅ `user_profiles` - 用户资料表
- ✅ `auth.users` - Supabase Auth用户表

#### SQL 查询示例：
```sql
-- 客户列表（通过订单获取）
SELECT DISTINCT
  u.id,
  up.full_name,
  u.email,
  up.phone,
  COUNT(b.id) as order_count,
  SUM(b.final_price) as total_spent,
  MAX(b.created_at) as last_order_date
FROM bookings b
JOIN auth.users u ON u.id = b.user_id
LEFT JOIN user_profiles up ON up.id = u.id
WHERE b.merchant_id = ?
GROUP BY u.id, up.full_name, u.email, up.phone
ORDER BY last_order_date DESC;
```

#### 需要的页面和API：
- ⚠️ `/merchant/customers` 页面 - 需要创建
- ⚠️ `GET /api/merchant/customers` - 需要创建

---

## 📊 数据表覆盖检查

| 商家端功能 | 数据表 | 字段 | 状态 |
|------------|--------|------|------|
| **Dashboard 统计** | `bookings`, `tours` | 所有统计字段 | ✅ |
| **最近订单** | `bookings` + `tours` | 订单详情 | ✅ |
| **收入明细** | `bookings` + `tours` | 收入、手续费、结算状态 | ✅ |
| **产品管理** | `tours` | 所有产品字段 | ✅ |
| **订单管理** | `bookings` + `tours` | 所有订单字段 | ✅ |
| **数据分析** | `bookings` + `tours` | 统计数据 | ✅ |
| **商家设置** | `merchants`, `merchant_settings` | 所有设置字段 | ✅ |
| **客户管理** | `bookings` + `user_profiles` | 客户信息 | ✅ |

---

## ⚠️ 缺失的API端点

### 需要创建的API：

1. **Dashboard Stats API**
   - `GET /api/merchant/dashboard/stats`
   - 返回所有Dashboard统计数据

2. **Analytics API**
   - `GET /api/merchant/analytics`
   - 返回分析数据（总营收、订单数、热门产品、销售趋势）

3. **Settings API**
   - `GET /api/merchant/settings`
   - `PATCH /api/merchant/settings`
   - 获取和更新商家设置

4. **Customers API**
   - `GET /api/merchant/customers`
   - 获取客户列表

5. **Products Update/Delete API**
   - `PATCH /api/merchant/products` (更新产品)
   - `DELETE /api/merchant/products` (删除产品)

---

## ✅ 完整覆盖确认

### 所有商家端功能都已连接数据表：

1. ✅ **Dashboard 统计** → `bookings`, `tours`
2. ✅ **收入明细** → `bookings` (包含 settlement_status)
3. ✅ **产品管理** → `tours`
4. ✅ **订单管理** → `bookings` + `tours`
5. ✅ **数据分析** → `bookings` + `tours`
6. ✅ **商家设置** → `merchants` + `merchant_settings`
7. ✅ **客户管理** → `bookings` + `user_profiles`

---

## 📝 SQL查询示例

### Dashboard 完整统计查询：

```sql
-- 获取商家Dashboard所有统计数据
WITH merchant_stats AS (
  SELECT 
    -- 订单统计
    (SELECT COUNT(*) FROM bookings 
     WHERE merchant_id = ? AND DATE(booking_date) = CURRENT_DATE) as today_orders,
    
    (SELECT COUNT(*) FROM bookings 
     WHERE merchant_id = ? AND status = 'pending') as pending_orders,
    
    -- 产品统计
    (SELECT COUNT(*) FROM tours 
     WHERE merchant_id = ?) as total_products,
    
    (SELECT COUNT(*) FROM tours 
     WHERE merchant_id = ? AND is_active = true) as active_products,
    
    -- 收入统计
    (SELECT COALESCE(SUM(final_price), 0) FROM bookings 
     WHERE merchant_id = ? AND DATE(booking_date) = CURRENT_DATE) as today_revenue,
    
    (SELECT COALESCE(SUM(final_price), 0) FROM bookings 
     WHERE merchant_id = ?) as total_revenue,
    
    -- 结算统计（扣除10%平台手续费）
    (SELECT COALESCE(SUM(final_price * 0.9), 0) FROM bookings 
     WHERE merchant_id = ? 
     AND payment_status = 'paid' 
     AND settlement_status = 'pending') as pending_settlement,
    
    (SELECT COALESCE(SUM(final_price * 0.9), 0) FROM bookings 
     WHERE merchant_id = ? 
     AND settlement_status = 'settled') as settled_revenue
)
SELECT * FROM merchant_stats;
```

---

**最后更新**: 2024年

