# Supabase 数据库设置指南

## 一、Supabase 项目创建步骤

### 1. 创建 Supabase 项目
1. 访问 [https://supabase.com](https://supabase.com)
2. 注册/登录账号
3. 点击 "New Project"
4. 填写项目信息：
   - **Name**: `atockorea` (或你喜欢的名称)
   - **Database Password**: 设置一个强密码（请保存好！）
   - **Region**: 选择离韩国最近的区域（如 `Northeast Asia (Seoul)`）
5. 点击 "Create new project"
6. 等待项目创建完成（约 2-3 分钟）

### 2. 获取项目凭证
1. 进入项目后，点击左侧菜单的 **Settings** (齿轮图标)
2. 点击 **API** 选项
3. 复制以下信息（稍后会用到）：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (保密，仅服务器端使用)

## 二、数据库表结构设计

### 需要创建的表：

1. **tours** - 旅游产品表
2. **bookings** - 预订表
3. **reviews** - 评价表
4. **wishlist** - 收藏表
5. **cart_items** - 购物车表
6. **tour_images** - 旅游产品图片表（可选，用于画廊）
7. **pickup_points** - 接送点表（可选）

## 三、执行 SQL 脚本

### 步骤：
1. 在 Supabase 项目中，点击左侧菜单的 **SQL Editor**
2. 点击 **New query**
3. 复制 `supabase/schema.sql` 文件中的所有 SQL 代码
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 或按 `Ctrl+Enter` 执行
6. 确认所有表创建成功（左侧菜单 **Table Editor** 中可以看到）

## 四、设置 Row Level Security (RLS)

### 步骤：
1. 在 Supabase 项目中，点击左侧菜单的 **Authentication**
2. 点击 **Policies**
3. 为每个表设置 RLS 策略（详见 `supabase/rls-policies.sql`）

## 五、配置环境变量

### 步骤：
1. 在项目根目录创建 `.env.local` 文件（如果不存在）
2. 添加以下环境变量：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_Project_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_public_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key（仅服务器端使用）
```

⚠️ **重要**: 
- `.env.local` 文件已添加到 `.gitignore`，不会被提交到 Git
- 不要将密钥提交到代码仓库

## 六、安装 Supabase 客户端

### 步骤：
1. 在项目根目录运行：
```bash
npm install @supabase/supabase-js
```

2. 创建 Supabase 客户端配置文件（详见 `lib/supabase.ts`）

## 七、验证设置

### 测试连接：
1. 运行项目：`npm run dev`
2. 检查浏览器控制台是否有错误
3. 尝试注册/登录功能
4. 检查 Supabase Dashboard 的 **Authentication** > **Users** 中是否有新用户

## 八、数据迁移（可选）

如果需要将现有的 `data/tours.ts` 中的数据导入到数据库：

1. 创建迁移脚本（详见 `supabase/migrate-tours.ts`）
2. 运行迁移脚本将数据导入数据库

---

## 下一步

完成以上步骤后，可以：
1. 更新代码以使用 Supabase 数据库而不是本地数据
2. 实现用户认证功能
3. 实现购物车、收藏、预订等功能的数据库操作

