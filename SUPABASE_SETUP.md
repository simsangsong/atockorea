# Supabase 数据库快速设置指南

## 📋 步骤概览

### 第一步：创建 Supabase 项目

1. **访问 Supabase**
   - 打开 [https://supabase.com](https://supabase.com)
   - 注册/登录账号

2. **创建新项目**
   - 点击 "New Project"
   - 填写信息：
     - **Name**: `atockorea`
     - **Database Password**: 设置强密码（请保存！）
     - **Region**: 选择 `Northeast Asia (Seoul)` 或最近的区域
   - 点击 "Create new project"
   - 等待 2-3 分钟创建完成

3. **获取 API 密钥**
   - 进入项目后，点击左侧 **Settings** (⚙️)
   - 点击 **API**
   - 复制以下信息：
     - ✅ **Project URL** (例如: `https://xxxxx.supabase.co`)
     - ✅ **anon public** key (以 `eyJhbG...` 开头)
     - ✅ **service_role** key (以 `eyJhbG...` 开头，**保密！**)

---

### 第二步：执行 SQL 脚本创建表

1. **打开 SQL Editor**
   - 在 Supabase 项目中，点击左侧 **SQL Editor**
   - 点击 **New query**

2. **执行 SQL 脚本**
   - 打开项目中的 `supabase/schema.sql` 文件
   - 复制**全部内容**
   - 粘贴到 SQL Editor
   - 点击 **Run** 或按 `Ctrl+Enter`
   - ✅ 确认执行成功（应该看到 "Success. No rows returned"）

3. **验证表创建**
   - 点击左侧 **Table Editor**
   - 应该看到以下表：
     - ✅ `tours`
     - ✅ `pickup_points`
     - ✅ `bookings`
     - ✅ `reviews`
     - ✅ `wishlist`
     - ✅ `cart_items`
     - ✅ `user_profiles`

---

### 第三步：安装依赖

在项目根目录运行：

```bash
npm install @supabase/supabase-js
```

---

### 第四步：配置环境变量

1. **创建 `.env.local` 文件**
   - 在项目根目录创建 `.env.local` 文件
   - ⚠️ 这个文件已经在 `.gitignore` 中，不会被提交到 Git

2. **添加环境变量**
   
   在 `.env.local` 文件中添加：

   ```env
   NEXT_PUBLIC_SUPABASE_URL=你的_Project_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_public_key
   SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
   ```

   **示例：**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

---

### 第五步：验证设置

1. **重启开发服务器**
   ```bash
   # 停止当前服务器 (Ctrl+C)
   npm run dev
   ```

2. **检查连接**
   - 打开浏览器控制台（F12）
   - 检查是否有 Supabase 相关错误
   - 如果看到 "Missing Supabase environment variables" 错误，检查 `.env.local` 文件

3. **测试认证功能**
   - 访问 `/signin` 页面
   - 尝试注册新用户
   - 在 Supabase Dashboard > **Authentication** > **Users** 中查看是否有新用户

---

## 📊 数据库表结构说明

### 1. **tours** - 旅游产品表
存储所有旅游产品的详细信息

### 2. **pickup_points** - 接送点表
存储每个旅游产品的接送点信息（地址、坐标、时间）

### 3. **bookings** - 预订表
存储用户的预订信息（日期、人数、价格、状态等）

### 4. **reviews** - 评价表
存储用户对旅游产品的评价和评分

### 5. **wishlist** - 收藏表
存储用户收藏的旅游产品

### 6. **cart_items** - 购物车表
存储用户购物车中的商品

### 7. **user_profiles** - 用户扩展信息表
存储用户的额外信息（姓名、头像、电话等）

---

## 🔒 安全设置（Row Level Security）

所有表都已启用 **Row Level Security (RLS)**，策略如下：

- ✅ **tours**: 所有人可查看，仅管理员可修改
- ✅ **bookings**: 用户只能查看/修改自己的预订
- ✅ **reviews**: 所有人可查看，用户只能创建/修改自己的评价
- ✅ **wishlist**: 用户只能查看/修改自己的收藏
- ✅ **cart_items**: 用户只能查看/修改自己的购物车
- ✅ **user_profiles**: 用户只能查看/修改自己的资料

---

## 🚀 下一步

完成以上步骤后，你可以：

1. **更新代码使用 Supabase**
   - 替换本地数据文件（`data/tours.ts`）为 Supabase 查询
   - 实现用户认证功能
   - 实现购物车、收藏、预订等功能的数据库操作

2. **导入初始数据**
   - 将 `data/tours.ts` 中的旅游产品数据导入到数据库
   - 可以使用 Supabase Dashboard 的 Table Editor 手动导入
   - 或创建迁移脚本自动导入

3. **测试功能**
   - 测试用户注册/登录
   - 测试添加购物车
   - 测试创建预订
   - 测试添加收藏

---

## ❓ 常见问题

### Q: 如何查看数据库中的数据？
A: 在 Supabase Dashboard 中，点击左侧 **Table Editor**，选择表即可查看数据。

### Q: 如何修改表结构？
A: 在 Supabase Dashboard 中，点击左侧 **SQL Editor**，编写 ALTER TABLE 语句执行。

### Q: 忘记数据库密码怎么办？
A: 在 Supabase Dashboard > Settings > Database 中可以重置密码。

### Q: 如何备份数据库？
A: 在 Supabase Dashboard > Settings > Database > Backups 中可以设置自动备份。

---

## 📚 相关文件

- `supabase/schema.sql` - 数据库架构 SQL 脚本
- `lib/supabase.ts` - Supabase 客户端配置
- `docs/supabase-setup.md` - 详细设置文档

---

**需要帮助？** 查看 Supabase 官方文档：https://supabase.com/docs

