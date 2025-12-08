# AtoCKorea 后台管理系统文档

## 系统架构

本系统包含两个独立的后台管理系统：

1. **总台后台 (Admin Panel)** - `/admin`
   - 管理所有商家
   - 查看所有产品和订单
   - 系统级数据分析
   - 系统设置

2. **商家后台 (Merchant Dashboard)** - `/merchant`
   - 商家管理自己的产品
   - 查看自己的订单
   - 客户管理
   - 数据分析（仅限自己的数据）
   - 商家设置

## 数据隔离机制

### 核心原则
- 每个商家只能访问自己的数据
- 通过 `merchant_id` 字段进行数据隔离
- 所有商家API自动注入 `merchant_id` 过滤条件

### 实现方式

1. **数据库层面**
   - `tours` 表添加 `merchant_id` 字段
   - `bookings` 表添加 `merchant_id` 字段（用于快速查询）
   - 通过触发器自动更新 `bookings.merchant_id`

2. **API层面**
   - 使用 `withMerchantIsolation` 中间件
   - 自动从认证用户获取 `merchant_id`
   - 所有查询自动添加 `WHERE merchant_id = :merchantId`

3. **RLS策略**
   - Supabase Row Level Security (RLS)
   - 商家只能SELECT/UPDATE自己的数据
   - 管理员可以访问所有数据

## 数据库Schema扩展

### 新增表

1. **merchants** - 商家信息表
2. **product_inventory** - 产品库存/名额管理
3. **merchant_settings** - 商家设置

### 修改的表

1. **user_profiles** - 添加 `role` 字段（customer/merchant/admin）
2. **tours** - 添加 `merchant_id` 字段
3. **bookings** - 添加 `merchant_id` 字段

运行以下SQL来应用schema扩展：

```sql
-- 在Supabase SQL Editor中运行
\i supabase/merchant-schema.sql
```

## 认证和权限

### 用户角色

- **customer** - 普通用户（默认）
- **merchant** - 商家用户
- **admin** - 管理员

### API认证

所有API请求需要在Header中携带JWT token：

```
Authorization: Bearer <token>
```

### 权限控制

- **总台API** (`/api/admin/*`) - 需要 `admin` 角色
- **商家API** (`/api/merchant/*`) - 需要 `merchant` 或 `admin` 角色，自动数据隔离

## API路由

### 总台API

- `GET /api/admin/merchants` - 获取所有商家
- `POST /api/admin/merchants` - 创建新商家
- `GET /api/admin/products` - 获取所有产品
- `GET /api/admin/orders` - 获取所有订单

### 商家API（自动数据隔离）

- `GET /api/merchant/products` - 获取商家的产品
- `POST /api/merchant/products` - 创建产品（自动分配merchant_id）
- `GET /api/merchant/orders` - 获取商家的订单
- `PATCH /api/merchant/orders` - 更新订单状态
- `GET /api/merchant/analytics` - 获取商家数据分析

## 使用流程

### 1. 创建商家账户（总台操作）

1. 登录总台后台 (`/admin`)
2. 进入"商家管理"
3. 点击"添加新商家"
4. 填写商家信息：
   - 公司名称
   - 联系人信息
   - 邮箱（将作为登录账号）
   - 密码（初始密码）
5. 系统自动：
   - 创建用户账户
   - 设置角色为 `merchant`
   - 创建商家记录
   - 创建默认设置

### 2. 商家登录

1. 商家使用注册的邮箱和密码登录
2. 系统识别角色为 `merchant`
3. 自动获取 `merchant_id`
4. 重定向到商家后台 (`/merchant`)

### 3. 商家管理产品

1. 进入"产品管理"
2. 添加/编辑产品
3. 所有产品自动关联到该商家
4. 只能看到和管理自己的产品

### 4. 商家处理订单

1. 进入"订单管理"
2. 查看所有订单（仅限自己的产品产生的订单）
3. 更新订单状态（确认/取消）
4. 查看订单详情

## 安全特性

1. **数据隔离**
   - 商家无法访问其他商家的数据
   - API自动过滤，防止数据泄露

2. **权限验证**
   - 每个API请求验证用户角色
   - 未授权访问返回403错误

3. **RLS策略**
   - 数据库层面的安全控制
   - 即使绕过API，也无法访问其他商家数据

## 待实现功能

- [ ] 完整的认证流程（登录/登出）
- [ ] 产品库存管理（日期、名额）
- [ ] 价格日历（动态定价）
- [ ] 订单导出功能
- [ ] 数据分析图表
- [ ] 客户管理详细功能
- [ ] 通知系统集成
- [ ] 结算功能

## 环境变量

确保在 `.env.local` 中配置：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 开发注意事项

1. **数据隔离测试**
   - 创建多个商家账户
   - 验证商家A无法看到商家B的数据

2. **权限测试**
   - 验证普通用户无法访问商家/总台后台
   - 验证商家无法访问总台API

3. **API测试**
   - 使用Postman或类似工具测试API
   - 确保携带正确的Authorization header

