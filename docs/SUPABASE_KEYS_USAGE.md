# Supabase API Keys 使用位置指南

## 📋 概述

Supabase API Keys 在项目中的使用位置和用途。

---

## 🔑 三个重要的 Keys

### 1. Project URL
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
```

### 2. anon public key（公开密钥）
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. service_role key（服务密钥）⚠️ 保密！
```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📍 使用位置

### 位置1：`.env.local` 文件（环境变量配置）

**文件路径：** 项目根目录 `.env.local`

**内容：**
```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://cghyvbwmijqpahnoduyv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_public_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

# 应用URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**用途：**
- 存储所有 Supabase 配置
- 被其他文件读取使用
- ⚠️ **不要提交到 Git**（已在 `.gitignore` 中）

---

### 位置2：`lib/supabase.ts`（Supabase 客户端配置）

**文件路径：** `lib/supabase.ts`

**使用情况：**

#### 2.1 客户端使用（anon key）

```typescript
// 第4-5行：读取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 第9-17行：创建客户端（使用 anon key）
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
```

**用途：**
- 前端组件使用
- 客户端数据查询
- 用户认证（登录、注册）
- 受 RLS (Row Level Security) 保护

**使用示例：**
```typescript
// 在客户端组件中
import { supabase } from '@/lib/supabase';

// 查询数据
const { data } = await supabase.from('tours').select('*');

// 用户登录
const { data } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
});
```

#### 2.2 服务器端使用（service_role key）

```typescript
// 第21-32行：创建服务器客户端（使用 service_role key）
export const createServerClient = () => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase environment variables...');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
```

**用途：**
- API 路由使用
- 管理员操作
- 绕过 RLS（完整权限）
- ⚠️ **只在服务器端使用**

**使用示例：**
```typescript
// 在 API 路由中
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  
  // 创建用户（需要管理员权限）
  const { data } = await supabase.auth.admin.createUser({
    email: 'user@example.com',
    password: 'password'
  });
}
```

---

### 位置3：API 路由（后端使用）

#### 3.1 商家登录 API

**文件：** `app/api/auth/merchant/login/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase';

// 使用 service_role key 进行认证
const supabase = createServerClient();
```

#### 3.2 创建商家 API

**文件：** `app/api/admin/merchants/create/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase';

// 使用 service_role key 创建用户
const supabase = createServerClient();
const { data } = await supabase.auth.admin.createUser({...});
```

#### 3.3 商家产品管理 API

**文件：** `app/api/merchant/products/route.ts`

```typescript
import { createServerClient } from '@/lib/supabase';

// 使用 service_role key 查询数据（自动数据隔离）
const supabase = createServerClient();
```

**所有 API 路由都使用：**
- `createServerClient()` - 使用 `SUPABASE_SERVICE_ROLE_KEY`
- 位置：`app/api/**/*.ts`

---

### 位置4：创建商家脚本

**文件：** `scripts/create-merchant.js`

```javascript
// 第12-13行：读取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 第23行：创建客户端
const supabase = createClient(supabaseUrl, serviceRoleKey, {...});
```

**用途：**
- 命令行脚本
- 创建商家账户
- 需要 `service_role key`（管理员权限）

**运行：**
```bash
npm run create-merchant
```

---

### 位置5：认证工具函数

**文件：** `lib/auth.ts`

```typescript
import { createServerClient } from './supabase';

// 使用 service_role key 验证用户
const supabase = createServerClient();
const { data: { user } } = await supabase.auth.getUser(token);
```

**用途：**
- 验证 JWT token
- 检查用户角色
- 获取用户信息

---

## 🔐 安全说明

### anon public key（可以公开）

- ✅ 可以用于前端代码
- ✅ 可以提交到 Git（虽然不推荐）
- ✅ 受 RLS 保护，安全
- ✅ 用于：客户端组件、用户操作

### service_role key（绝密！）

- ⚠️ **绝密！** 不要暴露
- ⚠️ 只在服务器端使用
- ⚠️ 绕过 RLS，拥有完整权限
- ⚠️ 不要提交到 Git
- ⚠️ 用于：API 路由、管理员操作、脚本

---

## 📝 配置步骤

### 步骤1：获取 Keys

1. Supabase Dashboard → Settings → API Keys
2. 复制：
   - Project URL
   - anon public key
   - service_role key

### 步骤2：配置 `.env.local`

在项目根目录创建 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_public_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 步骤3：重启开发服务器

```bash
# 停止服务器（Ctrl+C）
npm run dev
```

---

## 🎯 使用场景总结

| 场景 | 使用的 Key | 文件位置 |
|------|-----------|---------|
| 前端组件查询数据 | anon public | `lib/supabase.ts` → `supabase` |
| 用户登录/注册 | anon public | 客户端组件 |
| API 路由操作 | service_role | `lib/supabase.ts` → `createServerClient()` |
| 创建用户（管理员） | service_role | `app/api/admin/**/*.ts` |
| 商家管理操作 | service_role | `app/api/merchant/**/*.ts` |
| 命令行脚本 | service_role | `scripts/create-merchant.js` |

---

## ✅ 验证配置

### 检查1：环境变量是否加载

```typescript
// 在组件中测试
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
// 应该显示你的 Supabase URL
```

### 检查2：客户端连接

```typescript
import { supabase } from '@/lib/supabase';

// 测试连接
const { data, error } = await supabase.from('tours').select('count');
console.log('Connection:', error ? 'Failed' : 'Success');
```

### 检查3：服务器端连接

```typescript
import { createServerClient } from '@/lib/supabase';

// 在 API 路由中测试
const supabase = createServerClient();
const { data, error } = await supabase.from('tours').select('count');
```

---

## 🆘 常见问题

### Q: 为什么有两个不同的客户端？

**A:**
- `supabase`（anon key）- 前端使用，受 RLS 保护
- `createServerClient()`（service_role key）- 后端使用，完整权限

### Q: 可以在前端使用 service_role key 吗？

**A:** ❌ **绝对不行！** 这会暴露完整权限，非常危险！

### Q: 如何知道该用哪个 key？

**A:**
- 前端组件 → 使用 `supabase`（anon key）
- API 路由 → 使用 `createServerClient()`（service_role key）
- 脚本 → 使用 `createServerClient()`（service_role key）

### Q: 环境变量不生效？

**A:**
1. 检查文件名：`.env.local`（不是 `.env.local.txt`）
2. 检查位置：项目根目录
3. 重启开发服务器
4. 检查变量名：`NEXT_PUBLIC_` 前缀用于客户端

---

## 📚 相关文档

- `docs/HOW_TO_GET_API_KEYS.md` - 如何获取 API Keys
- `docs/SUPABASE_COMPLETE_SETUP.md` - 完整设置指南
- `lib/supabase.ts` - Supabase 客户端配置

