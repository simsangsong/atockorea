# AtoCKorea API 文档

## 认证

所有API请求（除登录外）需要在Header中携带JWT token：

```
Authorization: Bearer <token>
```

## 总台API (Admin)

### 创建商家账户

**POST** `/api/admin/merchants/create`

**权限：** Admin only

**请求体：**
```json
{
  "company_name": "Jeju Travel Agency",
  "business_registration_number": "123-45-67890",
  "contact_person": "Kim Min-soo",
  "contact_email": "kim@jejutravel.com",
  "contact_phone": "010-1234-5678",
  "address_line1": "123 Main St",
  "city": "Jeju",
  "province": "Jeju",
  "postal_code": "63000",
  "country": "South Korea"
}
```

**响应：**
```json
{
  "merchant": {
    "id": "uuid",
    "company_name": "Jeju Travel Agency",
    "status": "pending",
    ...
  },
  "credentials": {
    "email": "kim@jejutravel.com",
    "temporaryPassword": "generated_password",
    "loginUrl": "http://localhost:3000/merchant/login"
  },
  "message": "Merchant account created successfully"
}
```

**速率限制：** 10次/小时

### 获取所有商家

**GET** `/api/admin/merchants`

**权限：** Admin only

**响应：**
```json
{
  "merchants": [
    {
      "id": "uuid",
      "company_name": "Jeju Travel Agency",
      "status": "active",
      ...
    }
  ]
}
```

## 商家认证API

### 商家登录

**POST** `/api/auth/merchant/login`

**请求体：**
```json
{
  "email": "kim@jejutravel.com",
  "password": "password"
}
```

**响应：**
```json
{
  "user": {
    "id": "uuid",
    "email": "kim@jejutravel.com",
    "role": "merchant",
    "merchantId": "uuid",
    "companyName": "Jeju Travel Agency"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    ...
  },
  "needsPasswordChange": true
}
```

**速率限制：** 5次/15分钟

### 修改密码

**POST** `/api/auth/merchant/change-password`

**权限：** Merchant

**请求体：**
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

**响应：**
```json
{
  "message": "Password changed successfully"
}
```

## 商家API (自动数据隔离)

### 获取产品列表

**GET** `/api/merchant/products`

**权限：** Merchant

**响应：**
```json
{
  "products": [
    {
      "id": "uuid",
      "title": "Jeju UNESCO Tour",
      "merchant_id": "auto_set",
      ...
    }
  ]
}
```

**注意：** 自动只返回该商家的产品

### 创建产品

**POST** `/api/merchant/products`

**权限：** Merchant

**请求体：**
```json
{
  "title": "New Tour",
  "city": "Jeju",
  "price": 80000,
  "price_type": "person",
  "image_url": "https://...",
  ...
}
```

**响应：**
```json
{
  "product": {
    "id": "uuid",
    "merchant_id": "auto_set",
    ...
  }
}
```

**注意：** `merchant_id` 自动设置为当前商家ID

### 获取订单列表

**GET** `/api/merchant/orders`

**权限：** Merchant

**响应：**
```json
{
  "orders": [
    {
      "id": "uuid",
      "tour_date": "2024-01-20",
      "status": "pending",
      "final_price": 160000,
      "tours": {
        "title": "Jeju UNESCO Tour",
        "city": "Jeju"
      },
      ...
    }
  ]
}
```

**注意：** 自动只返回该商家产品的订单

### 更新订单状态

**PATCH** `/api/merchant/orders?id=<order_id>`

**权限：** Merchant

**请求体：**
```json
{
  "status": "confirmed"
}
```

**响应：**
```json
{
  "order": {
    "id": "uuid",
    "status": "confirmed",
    ...
  }
}
```

**注意：** 只能更新自己产品的订单

## 错误响应

所有API错误遵循统一格式：

```json
{
  "error": "Error message"
}
```

**HTTP状态码：**
- `200` - 成功
- `201` - 创建成功
- `400` - 请求错误
- `401` - 未认证
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 速率限制
- `500` - 服务器错误

## 速率限制响应

当超过速率限制时：

```json
{
  "error": "Too many requests. Please try again later.",
  "retryAfter": 300
}
```

**Headers：**
```
Retry-After: 300
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1234567890
```

## 数据隔离说明

所有商家API (`/api/merchant/*`) 自动实现数据隔离：

1. 从JWT token获取 `merchant_id`
2. 所有查询自动添加 `WHERE merchant_id = :merchantId`
3. 商家无法访问其他商家的数据
4. 管理员可以访问所有数据（通过总台API）

## 测试工具

### 使用 curl

```bash
# 登录
TOKEN=$(curl -X POST http://localhost:3000/api/auth/merchant/login \
  -H "Content-Type: application/json" \
  -d '{"email":"merchant@example.com","password":"password"}' \
  | jq -r '.session.access_token')

# 获取产品
curl -X GET http://localhost:3000/api/merchant/products \
  -H "Authorization: Bearer $TOKEN"
```

### 使用 Postman

1. 创建环境变量 `base_url` = `http://localhost:3000`
2. 创建环境变量 `merchant_token`
3. 在登录请求的Tests中设置：
   ```javascript
   pm.environment.set("merchant_token", pm.response.json().session.access_token);
   ```
4. 在其他请求的Authorization中使用：`Bearer {{merchant_token}}`

