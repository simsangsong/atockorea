# 创建 LoveKorea 商家账户指南

## 账户信息
- **Email**: `lovekorea@lovekorea.com`
- **Password**: `lovekorea`
- **Login URL**: `http://localhost:3000/merchant/login`

## 方法1: 使用 Supabase Dashboard（推荐）

### 步骤1: 创建用户账户

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **Authentication** → **Users**
4. 点击 **Add User** 按钮
5. 填写信息：
   - **Email**: `lovekorea@lovekorea.com`
   - **Password**: `lovekorea`
   - **Auto Confirm User**: ✅ (勾选)
6. 点击 **Create User**
7. 复制创建的用户 ID (UUID)

### 步骤2: 执行 SQL 脚本

1. 在 Supabase Dashboard 中打开 **SQL Editor**
2. 打开文件 `supabase/create-lovekorea-merchant-complete.sql`
3. 复制整个 SQL 脚本
4. 粘贴到 SQL Editor
5. 点击 **Run** 执行

脚本会自动：
- 查找用户 ID
- 创建用户 profile
- 创建商家记录
- 创建默认设置
- 设置状态为 `active` 和 `verified`

## 方法2: 使用 Node.js 脚本

### 前提条件

确保 `.env.local` 文件包含：
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 执行脚本

```bash
node scripts/create-lovekorea-direct.js
```

脚本会自动：
- 检查用户是否已存在（如果存在会删除旧账户）
- 创建新用户账户
- 创建所有相关记录
- 显示登录凭证

## 方法3: 使用 Supabase CLI

```bash
# 创建用户
supabase auth users create lovekorea@lovekorea.com --password lovekorea

# 然后执行 SQL 脚本
# 在 Supabase Dashboard 的 SQL Editor 中执行 create-lovekorea-merchant-complete.sql
```

## 验证账户

创建成功后，可以：

1. **登录测试**:
   - 访问: `http://localhost:3000/merchant/login`
   - 使用邮箱和密码登录

2. **检查数据库**:
   ```sql
   SELECT * FROM merchants WHERE contact_email = 'lovekorea@lovekorea.com';
   SELECT * FROM user_profiles WHERE role = 'merchant';
   ```

## 故障排除

### 如果用户已存在
- SQL 脚本会自动更新现有记录
- Node.js 脚本会自动删除旧账户并创建新账户

### 如果遇到权限错误
- 确保使用 Service Role Key（不是 Anon Key）
- 在 Supabase Dashboard 中执行 SQL 脚本（有完整权限）

### 如果无法登录
- 检查用户状态是否为 `active`
- 检查 `is_verified` 是否为 `true`
- 检查 `user_profiles.role` 是否为 `merchant`

## 账户信息总结

创建成功后，账户信息：
- ✅ Email: `lovekorea@lovekorea.com`
- ✅ Password: `lovekorea`
- ✅ Status: `active`
- ✅ Verified: `true`
- ✅ Role: `merchant`
- ✅ Login URL: `http://localhost:3000/merchant/login`


