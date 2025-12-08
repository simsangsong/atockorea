# 商家后台系统 - 快速开始指南

## 系统概述

AtoCKorea 商家后台系统包含两个管理界面：

1. **总台后台** (`/admin`) - 管理所有商家
2. **商家后台** (`/merchant`) - 商家管理自己的业务

## 快速开始

### 1. 数据库设置

在 Supabase SQL Editor 中依次运行：

```sql
-- 1. 运行基础schema（如果还没有）
\i supabase/schema.sql

-- 2. 运行商家管理扩展schema
\i supabase/merchant-schema.sql

-- 3. 运行审计日志schema
\i supabase/audit-logs-schema.sql
```

### 2. 创建管理员账户

在 Supabase Dashboard 中：
1. 进入 Authentication → Users
2. 手动创建用户或使用 Supabase CLI
3. 在 `user_profiles` 表中设置 `role = 'admin'`

或者使用 SQL：

```sql
-- 假设已创建用户，ID为 'admin-user-id'
INSERT INTO user_profiles (id, full_name, role)
VALUES ('admin-user-id', 'Admin User', 'admin');
```

### 3. 创建第一个商家

1. 登录总台后台：`http://localhost:3000/admin`
2. 进入"商家管理" → "添加新商家"
3. 填写商家信息
4. 系统自动生成临时密码
5. 将登录凭证发送给商家

### 4. 商家首次登录

1. 商家访问：`http://localhost:3000/merchant/login`
2. 使用邮箱和临时密码登录
3. **强制修改密码**（首次登录）
4. 进入商家后台开始管理产品

## API 使用示例

### 总台创建商家

```bash
curl -X POST http://localhost:3000/api/admin/merchants/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "company_name": "Jeju Travel Agency",
    "contact_person": "Kim Min-soo",
    "contact_email": "kim@jejutravel.com",
    "contact_phone": "010-1234-5678"
  }'
```

### 商家登录

```bash
curl -X POST http://localhost:3000/api/auth/merchant/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "kim@jejutravel.com",
    "password": "temporary_password"
  }'
```

### 商家获取产品（自动数据隔离）

```bash
curl -X GET http://localhost:3000/api/merchant/products \
  -H "Authorization: Bearer MERCHANT_TOKEN"
```

## 安全特性

### 已实现

✅ **数据隔离**
- 商家API自动过滤 `merchant_id`
- 数据库RLS策略双重保护

✅ **认证和权限**
- JWT token认证
- 角色验证（customer/merchant/admin）
- 首次登录强制改密

✅ **速率限制**
- 登录限制：5次/15分钟
- 创建商家限制：10次/小时
- API通用限制：100次/15分钟

✅ **文件上传限制**
- 产品图片：最大5MB
- 画廊图片：最大10MB
- 类型验证：仅允许图片格式

✅ **操作审计**
- 敏感操作记录到 `audit_logs`
- 记录IP地址、用户代理、时间戳

### 待实现

- [ ] 邮件服务集成（发送登录凭证）
- [ ] 敏感信息加密存储（银行账户）
- [ ] Webhook接口
- [ ] 多语言支持
- [ ] 多货币结算

## 测试数据隔离

### 测试脚本

```javascript
// 1. 创建两个商家账户（通过总台）
// 2. 分别登录获取token
const token1 = 'merchant1_token';
const token2 = 'merchant2_token';

// 3. 商家1创建产品
fetch('/api/merchant/products', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token1}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'Product from Merchant 1',
    // ... other fields
  })
});

// 4. 商家2尝试获取产品
fetch('/api/merchant/products', {
  headers: {
    'Authorization': `Bearer ${token2}`
  }
})
// 应该只返回商家2自己的产品，不包含商家1的产品
```

## 常见问题

### Q: 如何重置商家密码？

A: 总台管理员可以在 Supabase Dashboard 中重置，或通过API实现重置功能。

### Q: 商家可以删除自己的账户吗？

A: 不可以。账户删除需要总台管理员操作，确保数据完整性。

### Q: 如何查看操作日志？

A: 总台管理员可以访问 `audit_logs` 表查看所有操作记录。

### Q: 速率限制可以调整吗？

A: 可以，修改 `lib/rate-limit.ts` 中的配置。

## 部署检查清单

- [ ] 运行所有SQL schema文件
- [ ] 配置环境变量
- [ ] 设置管理员账户
- [ ] 测试商家创建流程
- [ ] 测试数据隔离
- [ ] 配置邮件服务（如需要）
- [ ] 设置SSL证书
- [ ] 配置备份策略

## 支持

如有问题，请查看：
- `docs/BACKEND_SYSTEM.md` - 系统架构文档
- `docs/MERCHANT_ONBOARDING.md` - 商家入驻流程文档

