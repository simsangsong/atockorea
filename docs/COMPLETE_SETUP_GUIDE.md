# AtoCKorea 完整设置指南
## Complete Setup Guide

### 📋 项目状态检查

#### Frontend 状态
- ✅ Next.js 14 应用
- ✅ 商家登录页面: `/merchant/login`
- ✅ 商家仪表板: `/merchant`
- ✅ 商家收入页面: `/merchant/revenue`
- ✅ 商家产品管理: `/merchant/products`
- ✅ 商家订单管理: `/merchant/orders`
- ✅ 移动端优先设计
- ✅ 韩语界面

#### Backend 状态
- ✅ Next.js API Routes
- ✅ Supabase 集成
- ✅ 商家认证: `/api/auth/merchant/login`
- ✅ 商家数据隔离中间件
- ✅ 商家收入API: `/api/merchant/revenue`
- ✅ 商家产品API: `/api/merchant/products`
- ✅ 商家订单API: `/api/merchant/orders`

### 🗄️ 数据库初始化步骤

#### 步骤 1: 创建用户账户

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Authentication** → **Users**
4. 点击 **"Add user"** → **"Create new user"**
5. 填写以下信息：
   - **Email**: `lovekorea@gmail.com`
   - **Password**: `lovekorea`
   - **Auto Confirm User**: ✅ (必须勾选！)
6. 点击 **"Create user"**

#### 步骤 2: 执行数据库初始化脚本

1. 在 Supabase Dashboard 中打开 **SQL Editor**
2. 打开文件 `supabase/init-complete-with-lovekorea.sql`
3. 复制整个 SQL 脚本
4. 粘贴到 SQL Editor
5. 点击 **Run** 执行

脚本将创建：
- ✅ `user_profiles` - 用户资料表
- ✅ `merchants` - 商家表
- ✅ `merchant_settings` - 商家设置表
- ✅ `tours` - 旅游产品表
- ✅ `bookings` - 订单表
- ✅ `settlements` - 结算表
- ✅ `settlement_bookings` - 结算订单关联表
- ✅ 所有必要的索引和触发器
- ✅ Row Level Security (RLS) 策略
- ✅ **LoveKorea 商家账户** (如果用户已创建)

### 🔐 LoveKorea 商家账户信息

创建完成后，你可以使用以下凭据登录：

- **Email**: `lovekorea@gmail.com`
- **Password**: `lovekorea`
- **登录地址**: `http://localhost:3000/merchant/login`
- **状态**: `active` (已激活)
- **验证状态**: `true` (已验证)

### 🚀 启动应用

```bash
# 安装依赖（如果还没有）
npm install

# 启动开发服务器
npm run dev
```

应用将在 `http://localhost:3000` 运行

### ✅ 验证设置

1. **验证数据库表**:
   ```sql
   -- 在 Supabase SQL Editor 中执行
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

2. **验证商家账户**:
   ```sql
   -- 在 Supabase SQL Editor 中执行
   SELECT 
     m.id,
     m.company_name,
     m.contact_email,
     m.status,
     m.is_verified,
     u.email
   FROM merchants m
   JOIN auth.users u ON u.id = m.user_id
   WHERE m.contact_email = 'lovekorea@gmail.com';
   ```

3. **测试登录**:
   - 访问 `http://localhost:3000/merchant/login`
   - 使用 `lovekorea@gmail.com` / `lovekorea` 登录
   - 应该能够成功登录并进入商家仪表板

### 📁 相关文件

- `supabase/init-complete-with-lovekorea.sql` - 完整初始化脚本
- `supabase/complete-schema.sql` - 基础数据库schema
- `supabase/merchant-schema.sql` - 商家管理扩展
- `supabase/settlement-schema.sql` - 结算功能扩展
- `app/merchant/login/page.tsx` - 商家登录页面
- `app/api/auth/merchant/login/route.ts` - 商家登录API
- `app/merchant/layout.tsx` - 商家布局（包含认证检查）

### ⚠️ 常见问题

#### 问题 1: 用户账户不存在
**错误**: `User not found. Please create user first`

**解决方案**: 
- 确保已在 Supabase Dashboard → Authentication → Users 中创建用户
- 确保 Email 是 `lovekorea@gmail.com`
- 确保勾选了 "Auto Confirm User"

#### 问题 2: 登录失败
**可能原因**:
- 用户未创建
- 密码错误
- 用户未确认

**解决方案**:
- 检查 Supabase Dashboard → Authentication → Users
- 确认用户状态为 "Confirmed"
- 尝试重置密码

#### 问题 3: 无法访问商家仪表板
**可能原因**:
- 商家记录未创建
- RLS 策略问题

**解决方案**:
- 检查 `merchants` 表中是否有记录
- 检查 `user_profiles` 表中 role 是否为 'merchant'
- 检查 RLS 策略是否正确设置

### 📝 下一步

1. ✅ 数据库表已创建
2. ✅ LoveKorea 商家账户已创建
3. ✅ 可以开始测试商家功能
4. ⏭️ 创建测试产品
5. ⏭️ 创建测试订单
6. ⏭️ 测试结算功能

### 🔗 相关文档

- [商家仪表板访问指南](./MERCHANT_DASHBOARD_ACCESS.md)
- [创建LoveKorea商家账户](./CREATE_LOVEKOREA_MERCHANT.md)


