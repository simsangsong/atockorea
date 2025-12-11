# AtoCKorea 完整数据库架构文档
## Complete Database Schema Documentation

### 📋 数据表总览

本系统共包含 **15个核心数据表**，涵盖用户端、商家端和管理端的所有功能。

---

## 1. 用户相关表

### 1.1 user_profiles (用户资料表)
存储用户的基本资料信息和SNS登录信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，关联 auth.users(id) |
| full_name | TEXT | 全名 |
| avatar_url | TEXT | 头像URL |
| phone | TEXT | 电话号码 |
| role | TEXT | 角色：customer/merchant/admin |
| language_preference | TEXT | 语言偏好：ko/en/zh |
| **auth_provider** | TEXT | **登录提供商：email/google/facebook/kakao/line** |
| **provider_user_id** | TEXT | **提供商用户ID（如Google的sub、LINE的userId等）** |
| **provider_metadata** | JSONB | **提供商元数据（存储额外的SNS信息）** |
| **last_login_method** | TEXT | **最后登录方式** |
| **last_login_at** | TIMESTAMP | **最后登录时间** |
| **linked_accounts** | JSONB | **关联的账户列表 [{provider, provider_user_id, linked_at}]** |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

**索引：**
- `idx_user_profiles_role`
- `idx_user_profiles_language`
- `idx_user_profiles_auth_provider` ⭐ **新增**
- `idx_user_profiles_provider_user_id` ⭐ **新增**
- `idx_user_profiles_last_login_at` ⭐ **新增**

**SNS登录支持：**
- ✅ **Google** - 通过 `auth_provider = 'google'` 标识
- ✅ **Facebook** - 通过 `auth_provider = 'facebook'` 标识
- ✅ **Kakao** - 通过 `auth_provider = 'kakao'` 标识
- ✅ **LINE** - 通过 `auth_provider = 'line'` 标识
- ✅ **Email** - 通过 `auth_provider = 'email'` 标识（默认）

**示例数据：**
```json
{
  "id": "uuid",
  "full_name": "John Doe",
  "auth_provider": "google",
  "provider_user_id": "1234567890",
  "provider_metadata": {
    "sub": "1234567890",
    "email": "john@gmail.com",
    "picture": "https://...",
    "name": "John Doe"
  },
  "linked_accounts": [
    {
      "provider": "google",
      "provider_user_id": "1234567890",
      "linked_at": "2024-01-01T00:00:00Z"
    },
    {
      "provider": "facebook",
      "provider_user_id": "9876543210",
      "linked_at": "2024-01-15T00:00:00Z"
    }
  ]
}
```

---

## 2. 商家相关表

### 2.1 merchants (商家表)
存储商家的基本信息和状态。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联用户ID（唯一） |
| company_name | TEXT | 公司名称 |
| business_registration_number | TEXT | 营业执照号（唯一） |
| contact_person | TEXT | 联系人 |
| contact_email | TEXT | 联系邮箱 |
| contact_phone | TEXT | 联系电话 |
| address_line1, address_line2 | TEXT | 地址 |
| city, province, postal_code | TEXT | 城市信息 |
| country | TEXT | 国家（默认：South Korea） |
| bank_name, bank_account_number | TEXT | 银行账户信息 |
| status | TEXT | 状态：pending/active/suspended/inactive |
| is_verified | BOOLEAN | 是否已验证 |
| notification_email, notification_phone | TEXT | 通知联系方式 |
| notes | TEXT | 备注 |

**索引：**
- `idx_merchants_user_id`
- `idx_merchants_status`
- `idx_merchants_email`
- `idx_merchants_business_registration`

### 2.2 merchant_settings (商家设置表)
存储商家的个性化设置。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| merchant_id | UUID | 商家ID（唯一） |
| email_notifications_enabled | BOOLEAN | 邮件通知开关 |
| sms_notifications_enabled | BOOLEAN | 短信通知开关 |
| new_order_notification | BOOLEAN | 新订单通知 |
| cancellation_notification | BOOLEAN | 取消通知 |
| review_notification | BOOLEAN | 评价通知 |
| auto_confirm_orders | BOOLEAN | 自动确认订单 |
| cancellation_policy_hours | INTEGER | 取消政策小时数 |
| refund_policy_percentage | DECIMAL | 退款政策百分比 |
| currency | TEXT | 货币（默认：KRW） |
| timezone | TEXT | 时区（默认：Asia/Seoul） |
| language | TEXT | 语言（默认：ko） |

---

## 3. 产品相关表

### 3.1 tours (旅游产品表)
存储所有旅游产品的详细信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| merchant_id | UUID | 商家ID |
| title | TEXT | 产品标题 |
| slug | TEXT | URL slug（唯一） |
| city | TEXT | 城市：Seoul/Busan/Jeju |
| tag | TEXT | 标签，如 "Jeju · Day tour" |
| subtitle, description | TEXT | 副标题和描述 |
| location | TEXT | 位置 |
| price | DECIMAL | 价格 |
| original_price | DECIMAL | 原价 |
| price_type | TEXT | 价格类型：person/group |
| currency | TEXT | 货币（默认：USD） |
| image_url | TEXT | 主图片URL |
| images | JSONB | 图片数组 |
| gallery_images | JSONB | 画廊图片数组 |
| rating | DECIMAL | 评分（0-5） |
| review_count | INTEGER | 评价数量 |
| duration | TEXT | 时长，如 "10 hours" |
| difficulty | TEXT | 难度 |
| group_size | TEXT | 团队规模 |
| highlight | TEXT | 亮点 |
| highlights | JSONB | 亮点数组 |
| badges | JSONB | 徽章数组 |
| includes | JSONB | 包含内容数组 |
| excludes | JSONB | 不包含内容数组 |
| schedule | JSONB | 行程安排 [{time, title, description}] |
| itinerary | JSONB | 行程地点数组 |
| faqs | JSONB | 常见问题 [{question, answer}] |
| pickup_points_count | INTEGER | 接送点数量 |
| dropoff_points_count | INTEGER | 下车点数量 |
| lunch_included | BOOLEAN | 是否包含午餐 |
| ticket_included | BOOLEAN | 是否包含门票 |
| pickup_info | TEXT | 接送信息 |
| notes | TEXT | 备注 |
| is_active | BOOLEAN | 是否激活 |
| is_featured | BOOLEAN | 是否推荐 |

**索引：**
- `idx_tours_merchant_id`
- `idx_tours_city`
- `idx_tours_slug`
- `idx_tours_is_active`
- `idx_tours_is_featured`
- `idx_tours_rating`
- `idx_tours_price`

**触发器：**
- 自动更新评分：当有新评价时自动更新 `rating` 和 `review_count`

### 3.2 pickup_points (接送点表)
存储产品的接送点信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tour_id | UUID | 产品ID |
| name | TEXT | 接送点名称 |
| address | TEXT | 地址 |
| lat, lng | DECIMAL | 经纬度 |
| pickup_time | TIME | 接送时间 |
| display_order | INTEGER | 显示顺序 |

### 3.3 product_inventory (产品库存表)
按日期管理产品的可用库存。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| tour_id | UUID | 产品ID |
| merchant_id | UUID | 商家ID |
| tour_date | DATE | 旅游日期 |
| available_spots | INTEGER | 可用名额 |
| reserved_spots | INTEGER | 已预订名额 |
| total_spots | INTEGER | 总名额 |
| max_capacity | INTEGER | 最大容量 |
| price_override | DECIMAL | 价格覆盖（可覆盖基础价格） |
| is_available | BOOLEAN | 是否可用 |

**唯一约束：** `(tour_id, tour_date)`

---

## 4. 订单相关表

### 4.1 bookings (订单表)
存储所有预订订单信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| tour_id | UUID | 产品ID |
| merchant_id | UUID | 商家ID（自动从tour获取） |
| booking_date | DATE | 预订日期 |
| tour_date | DATE | 旅游日期 |
| tour_time | TIME | 旅游时间 |
| number_of_guests | INTEGER | 客人数量 |
| number_of_people | INTEGER | 人数 |
| pickup_point_id | UUID | 接送点ID |
| unit_price | DECIMAL | 单价 |
| total_price | DECIMAL | 总价 |
| discount_amount | DECIMAL | 折扣金额 |
| final_price | DECIMAL | 最终价格 |
| tax_amount | DECIMAL | 税费 |
| promo_code | TEXT | 优惠券代码 |
| promo_discount | DECIMAL | 优惠券折扣 |
| status | TEXT | 订单状态：pending/confirmed/completed/cancelled |
| payment_status | TEXT | 支付状态：pending/paid/refunded/partially_refunded |
| settlement_status | TEXT | 结算状态：pending/settled/cancelled |
| payment_method | TEXT | 支付方式：stripe/paypal/card |
| payment_reference | TEXT | 支付参考号 |
| paid_at | TIMESTAMP | 支付时间 |
| contact_name, contact_email, contact_phone | TEXT | 联系人信息 |
| special_requests | TEXT | 特殊要求 |
| cancelled_at | TIMESTAMP | 取消时间 |
| cancellation_reason | TEXT | 取消原因 |
| refund_eligible | BOOLEAN | 是否可退款 |
| refund_processed | BOOLEAN | 是否已退款 |
| refund_amount | DECIMAL | 退款金额 |

**索引：**
- `idx_bookings_user_id`
- `idx_bookings_tour_id`
- `idx_bookings_merchant_id`
- `idx_bookings_status`
- `idx_bookings_payment_status`
- `idx_bookings_settlement_status`
- `idx_bookings_booking_date`
- `idx_bookings_tour_date`
- `idx_bookings_created_at`

**触发器：**
- 自动更新 `merchant_id`（从 `tours` 表获取）

### 4.2 cart_items (购物车表)
存储用户的购物车物品。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| tour_id | UUID | 产品ID |
| tour_date | DATE | 旅游日期 |
| tour_time | TIME | 旅游时间 |
| quantity | INTEGER | 数量 |
| pickup_point_id | UUID | 接送点ID |
| unit_price | DECIMAL | 单价 |
| total_price | DECIMAL | 总价 |

**唯一约束：** `(user_id, tour_id, tour_date)`

---

## 5. 用户互动表

### 5.1 wishlist (收藏表)
存储用户收藏的产品。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| tour_id | UUID | 产品ID |

**唯一约束：** `(user_id, tour_id)`

### 5.2 reviews (评价表)
存储用户对产品的评价。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| tour_id | UUID | 产品ID |
| booking_id | UUID | 订单ID（可选） |
| rating | INTEGER | 评分（1-5） |
| title | TEXT | 评价标题 |
| comment | TEXT | 评价内容 |
| photos | JSONB | 图片URL数组 |
| is_verified | BOOLEAN | 是否已验证购买 |
| is_visible | BOOLEAN | 是否可见 |

**唯一约束：** `(user_id, tour_id, booking_id)`

**触发器：**
- 自动更新产品的 `rating` 和 `review_count`

---

## 6. 结算相关表

### 6.1 settlements (结算表)
存储商家结算记录。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| merchant_id | UUID | 商家ID |
| settlement_period_start | DATE | 结算周期开始 |
| settlement_period_end | DATE | 结算周期结束 |
| total_revenue | DECIMAL | 总收入 |
| platform_fee | DECIMAL | 平台手续费（10%） |
| merchant_payout | DECIMAL | 商家应得金额 |
| total_bookings | INTEGER | 订单总数 |
| settled_bookings | INTEGER | 已结算订单数 |
| status | TEXT | 状态：pending/processing/completed/failed/cancelled |
| payout_method | TEXT | 支付方式 |
| payout_reference | TEXT | 支付参考号 |
| payout_date | DATE | 支付日期 |
| notes | TEXT | 备注 |
| completed_at | TIMESTAMP | 完成时间 |

**唯一约束：** `(merchant_id, settlement_period_start, settlement_period_end)`

**触发器：**
- 结算完成后自动更新相关订单的 `settlement_status`

### 6.2 settlement_bookings (结算订单关联表)
记录哪些订单包含在哪个结算中。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| settlement_id | UUID | 结算ID |
| booking_id | UUID | 订单ID（唯一） |
| booking_revenue | DECIMAL | 订单收入（快照） |
| platform_fee_amount | DECIMAL | 平台手续费（快照） |
| merchant_payout_amount | DECIMAL | 商家应得（快照） |

**唯一约束：** `(booking_id)` - 每个订单只能被结算一次

---

## 7. 营销相关表

### 7.1 promo_codes (优惠券表)
存储优惠券/促销代码信息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| code | TEXT | 优惠券代码（唯一） |
| description | TEXT | 描述 |
| discount_type | TEXT | 折扣类型：percentage/fixed_amount |
| discount_value | DECIMAL | 折扣值 |
| min_purchase_amount | DECIMAL | 最小购买金额 |
| max_discount_amount | DECIMAL | 最大折扣金额 |
| max_uses | INTEGER | 最大使用次数 |
| used_count | INTEGER | 已使用次数 |
| valid_from | TIMESTAMP | 有效期开始 |
| valid_until | TIMESTAMP | 有效期结束 |
| applicable_tours | JSONB | 适用产品ID数组（空数组表示所有产品） |
| applicable_merchants | JSONB | 适用商家ID数组 |
| is_active | BOOLEAN | 是否激活 |

---

## 8. 系统相关表

### 8.1 emails (邮件/消息表)
存储系统发送的邮件和消息。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| from_email, from_name | TEXT | 发件人信息 |
| to_email, to_name | TEXT | 收件人信息 |
| subject | TEXT | 主题 |
| body_text, body_html | TEXT | 邮件内容 |
| user_id | UUID | 用户ID |
| booking_id | UUID | 订单ID |
| tour_id | UUID | 产品ID |
| status | TEXT | 状态：pending/sent/failed/bounced |
| sent_at | TIMESTAMP | 发送时间 |
| delivered_at | TIMESTAMP | 送达时间 |
| parent_email_id | UUID | 父邮件ID（用于回复） |
| is_reply | BOOLEAN | 是否是回复 |

### 8.2 audit_logs (审计日志表)
记录所有重要操作，用于审计。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 用户ID |
| action | TEXT | 操作类型 |
| resource_type | TEXT | 资源类型：tour/booking/merchant |
| resource_id | UUID | 资源ID |
| details | JSONB | 详细信息 |
| ip_address | INET | IP地址 |
| user_agent | TEXT | 用户代理 |

---

## 🔒 Row Level Security (RLS)

所有表都已启用 RLS，确保数据安全：

- **用户**：只能访问自己的数据
- **商家**：只能访问自己的产品和订单数据
- **管理员**：可以访问所有数据

---

## 🔄 自动触发器

1. **自动更新 `updated_at`**：所有表的更新操作都会自动更新 `updated_at`
2. **自动更新 `merchant_id`**：创建订单时自动从 `tours` 表获取 `merchant_id`
3. **自动更新产品评分**：有新评价时自动更新 `tours.rating` 和 `review_count`
4. **自动更新结算状态**：结算完成后自动更新相关订单的 `settlement_status`

---

## 📝 使用说明

### 执行初始化脚本

1. 在 Supabase Dashboard 中打开 **SQL Editor**
2. 打开文件 `supabase/complete-database-init.sql`
3. 复制整个脚本并执行
4. 脚本会：
   - ✅ 删除所有现有表（CASCADE）
   - ✅ 创建所有新表
   - ✅ 创建所有索引
   - ✅ 创建所有触发器
   - ✅ 配置 RLS 策略
   - ✅ 尝试创建 LoveKorea 商家账户（如果用户已存在）

### 创建用户账户

在执行脚本前，请先在 Supabase Dashboard → Authentication → Users 中创建用户：
- Email: `lovekorea@gmail.com`
- Password: `lovekorea`
- Auto Confirm User: ✅

---

**最后更新**: 2024年

