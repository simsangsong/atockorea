# Supabase 数据库完整设置指南（从零开始）

## 📋 目录

1. [Supabase 项目创建](#1-supabase-项目创建)
2. [数据库表结构说明](#2-数据库表结构说明)
3. [执行SQL脚本](#3-执行sql脚本)
4. [配置环境变量](#4-配置环境变量)
5. [验证设置](#5-验证设置)
6. [创建第一个管理员](#6-创建第一个管理员)

---

## 1. Supabase 项目创建

### 步骤1.1：注册/登录 Supabase

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击 "Start your project" 或 "Sign In"
3. 使用 GitHub 账号登录（推荐）或邮箱注册

### 步骤1.2：创建新项目

1. 登录后，点击 "New Project"
2. 填写项目信息：
   - **Name**: `atockorea` (或你喜欢的名称)
   - **Database Password**: 设置一个强密码（**请保存好！**）
   - **Region**: 选择离你最近的区域（如 `Southeast Asia (Singapore)`）
   - **Pricing Plan**: 选择 Free 计划即可
3. 点击 "Create new project"
4. 等待项目创建完成（约2分钟）

### 步骤1.3：获取项目信息

项目创建完成后，获取 API 密钥：

1. 在 Supabase Dashboard 左侧菜单，点击 **Settings**（设置）
2. 点击 **API Keys**（API 密钥）

你会看到以下信息：

- **Project URL**: `https://xxxxx.supabase.co`
  - 位置：在页面顶部，或 Data API 设置页面
- **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - 位置：在 API Keys 页面，标记为 "anon" 或 "public"
- **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` ⚠️ **保密！**
  - 位置：在 API Keys 页面，标记为 "service_role"
  - ⚠️ **重要：** 这个密钥有完整权限，不要暴露在前端代码中！

**请保存这些信息，稍后会用到！**

---

## 2. 数据库表结构说明

我们的系统需要以下数据库表：

### 2.1 基础表（用户和产品）

| 表名 | 用途 | 说明 |
|------|------|------|
| `user_profiles` | 用户资料 | 存储用户角色（customer/merchant/admin） |
| `tours` | 旅游产品 | 所有旅游产品，包含 `merchant_id` |
| `pickup_points` | 接送点 | 产品的接送地点 |
| `bookings` | 订单 | 客户预订记录 |
| `reviews` | 评价 | 产品评价 |
| `wishlist` | 收藏 | 用户收藏的产品 |
| `cart_items` | 购物车 | 购物车商品 |

### 2.2 商家管理表

| 表名 | 用途 | 说明 |
|------|------|------|
| `merchants` | 商家信息 | 商家公司信息、联系方式 |
| `merchant_settings` | 商家设置 | 商家个性化设置 |
| `product_inventory` | 产品库存 | 产品日期、名额管理 |

### 2.3 系统表

| 表名 | 用途 | 说明 |
|------|------|------|
| `audit_logs` | 操作日志 | 记录所有敏感操作 |

---

## 3. 执行SQL脚本

### 步骤3.1：打开SQL Editor

1. 在 Supabase Dashboard 左侧菜单，点击 **SQL Editor**
2. 点击 **New query** 创建新查询

### 步骤3.2：执行基础Schema（第一步）

复制以下SQL代码，粘贴到SQL Editor，然后点击 **Run**：

```sql
-- ============================================
-- AtoCKorea 基础数据库Schema
-- ============================================

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 用户资料表
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'merchant', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. 商家表
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  business_registration_number TEXT,
  contact_person TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'South Korea',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'inactive')),
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. 旅游产品表
-- ============================================
CREATE TABLE IF NOT EXISTS tours (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  city TEXT NOT NULL,
  location TEXT,
  price DECIMAL(10, 2) NOT NULL,
  original_price DECIMAL(10, 2),
  price_type TEXT DEFAULT 'person' CHECK (price_type IN ('person', 'group')),
  image_url TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  duration TEXT,
  difficulty TEXT,
  group_size TEXT,
  highlight TEXT,
  badges JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. 接送点表
-- ============================================
CREATE TABLE IF NOT EXISTS pickup_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  pickup_time TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. 订单表
-- ============================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tour_id UUID REFERENCES tours(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  number_of_guests INTEGER NOT NULL DEFAULT 1,
  pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE SET NULL,
  final_price DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  payment_method TEXT,
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. 评价表
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tour_id, booking_id)
);

-- ============================================
-- 7. 收藏表
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tour_id)
);

-- ============================================
-- 8. 购物车表
-- ============================================
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_date DATE,
  number_of_guests INTEGER DEFAULT 1,
  pickup_point_id UUID REFERENCES pickup_points(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, tour_id, booking_date)
);

-- ============================================
-- 9. 商家设置表
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE UNIQUE,
  notification_email TEXT,
  notification_sms BOOLEAN DEFAULT true,
  auto_confirm_orders BOOLEAN DEFAULT false,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_account_holder TEXT,
  currency TEXT DEFAULT 'KRW',
  language TEXT DEFAULT 'ko',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 10. 产品库存表
-- ============================================
CREATE TABLE IF NOT EXISTS product_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  available_spots INTEGER NOT NULL DEFAULT 0,
  total_spots INTEGER NOT NULL DEFAULT 0,
  price_override DECIMAL(10, 2),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tour_id, date)
);

-- ============================================
-- 11. 操作日志表（审计）
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 创建索引
-- ============================================

-- 用户资料索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 商家索引
CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);
CREATE INDEX IF NOT EXISTS idx_merchants_status ON merchants(status);

-- 产品索引
CREATE INDEX IF NOT EXISTS idx_tours_merchant_id ON tours(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tours_city ON tours(city);
CREATE INDEX IF NOT EXISTS idx_tours_is_active ON tours(is_active);

-- 订单索引
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tour_id ON bookings(tour_id);
CREATE INDEX IF NOT EXISTS idx_bookings_merchant_id ON bookings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON bookings(booking_date);

-- 评价索引
CREATE INDEX IF NOT EXISTS idx_reviews_tour_id ON reviews(tour_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);

-- 收藏索引
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);

-- 购物车索引
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- 库存索引
CREATE INDEX IF NOT EXISTS idx_product_inventory_tour_id ON product_inventory(tour_id);
CREATE INDEX IF NOT EXISTS idx_product_inventory_date ON product_inventory(date);

-- 审计日志索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tours ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 用户资料策略
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- 商家策略
CREATE POLICY "Merchants can view own merchant record"
  ON merchants FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Merchants can update own merchant record"
  ON merchants FOR UPDATE
  USING (auth.uid() = user_id);

-- 产品策略（数据隔离）
CREATE POLICY "Anyone can view active tours"
  ON tours FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants can manage own tours"
  ON tours FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 订单策略
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() = user_id OR
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can create own bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Merchants can update own product bookings"
  ON bookings FOR UPDATE
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 评价策略
CREATE POLICY "Anyone can view reviews"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create own reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- 收藏策略
CREATE POLICY "Users can manage own wishlist"
  ON wishlist FOR ALL
  USING (auth.uid() = user_id);

-- 购物车策略
CREATE POLICY "Users can manage own cart"
  ON cart_items FOR ALL
  USING (auth.uid() = user_id);

-- 商家设置策略
CREATE POLICY "Merchants can manage own settings"
  ON merchant_settings FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 产品库存策略
CREATE POLICY "Merchants can manage own inventory"
  ON product_inventory FOR ALL
  USING (
    tour_id IN (
      SELECT id FROM tours WHERE merchant_id IN (
        SELECT id FROM merchants WHERE user_id = auth.uid()
      )
    ) OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 审计日志策略（仅管理员）
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 完成！
-- ============================================
```

**执行完成后，你会看到 "Success. No rows returned" 或类似的成功消息。**

### 步骤3.3：验证表是否创建成功

在SQL Editor中运行以下查询，检查表是否都已创建：

```sql
-- 查看所有表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

应该看到以下11个表：
- `audit_logs`
- `bookings`
- `cart_items`
- `merchants`
- `merchant_settings`
- `pickup_points`
- `product_inventory`
- `reviews`
- `tours`
- `user_profiles`
- `wishlist`

---

## 4. 配置环境变量

### 步骤4.1：创建 `.env.local` 文件

在项目根目录创建 `.env.local` 文件（如果还没有）：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 应用URL（用于邮件链接等）
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**替换为你的实际值：**
- `NEXT_PUBLIC_SUPABASE_URL`: 从 Supabase Dashboard → Settings → API 获取
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 同上，使用 `anon public` key
- `SUPABASE_SERVICE_ROLE_KEY`: 同上，使用 `service_role` key（**保密！**）

### 步骤4.2：重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

---

## 5. 验证设置

### 步骤5.1：检查数据库连接

在浏览器中访问：`http://localhost:3000`

如果页面正常加载，说明连接成功！

### 步骤5.2：测试表结构

在 Supabase Dashboard → **Table Editor** 中，你应该能看到所有11个表。

点击任意表，应该能看到列结构。

---

## 6. 创建第一个管理员

### 方法1：通过 Supabase Dashboard（推荐）

1. **创建用户**
   - 进入 **Authentication** → **Users**
   - 点击 **Add user** → **Create new user**
   - 填写：
     - Email: `admin@atockorea.com`
     - Password: 设置一个强密码
     - Auto Confirm User: ✅ **勾选**
   - 点击 **Create user**
   - **复制用户ID**（UUID格式，如：`a1b2c3d4-e5f6-7890-abcd-ef1234567890`）

2. **设置管理员角色**
   - 进入 **SQL Editor**
   - 运行以下SQL（替换 `YOUR_USER_ID` 为刚才复制的用户ID）：

```sql
-- 创建用户资料并设置为管理员
INSERT INTO user_profiles (id, full_name, role)
VALUES ('YOUR_USER_ID', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### 方法2：使用SQL直接创建（高级）

```sql
-- 1. 创建认证用户（需要Supabase Admin API，通常通过Dashboard创建）
-- 2. 然后设置角色（使用上面的SQL）
```

---

## ✅ 完成检查清单

- [ ] Supabase项目已创建
- [ ] 所有11个表已创建
- [ ] 索引已创建
- [ ] RLS策略已启用
- [ ] 环境变量已配置
- [ ] 管理员账户已创建
- [ ] 可以访问 `http://localhost:3000/admin`

---

## 🎉 下一步

现在你可以：

1. **访问总台后台**：`http://localhost:3000/admin`
2. **创建商家账户**：运行 `npm run create-merchant`
3. **商家登录**：`http://localhost:3000/merchant/login`

---

## 🆘 常见问题

### Q: SQL执行失败，提示权限错误？

**A:** 确保你使用的是 Supabase Dashboard 的 SQL Editor，而不是其他数据库工具。

### Q: 表已存在错误？

**A:** 如果表已存在，可以：
1. 删除旧表重新创建（**会丢失数据！**）
2. 或者修改SQL使用 `CREATE TABLE IF NOT EXISTS`（已在脚本中）

### Q: RLS策略导致无法访问数据？

**A:** 检查：
1. 用户是否已登录
2. 用户角色是否正确
3. 在 Supabase Dashboard → Authentication → Users 中确认用户已创建

### Q: 如何查看表数据？

**A:** 在 Supabase Dashboard → **Table Editor** 中查看。

---

## 📚 相关文档

- `docs/BACKEND_SYSTEM.md` - 系统架构说明
- `docs/ACCESS_GUIDE.md` - 访问指南
- `docs/API_DOCUMENTATION.md` - API文档

祝你使用愉快！🎉

