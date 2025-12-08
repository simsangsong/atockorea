# 如何获取 Supabase API Keys

## 📍 获取路径

### 方法1：通过 Settings → API Keys（推荐）

1. **打开 Supabase Dashboard**
   - 登录 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择你的项目

2. **进入 API Keys 页面**
   - 左侧菜单点击 **Settings**（设置图标 ⚙️）
   - 点击 **API Keys**（API 密钥）

3. **查看 API Keys**
   - 你会看到两个密钥：
     - **anon public** - 公开密钥（前端使用）
     - **service_role** - 服务密钥（后端使用，保密！）

### 方法2：通过 Data API 页面

1. **打开 Data API 设置**
   - 左侧菜单点击 **Settings**
   - 点击 **Data API**

2. **查看 Project URL**
   - 在页面顶部可以看到 **Project URL**
   - 格式：`https://xxxxx.supabase.co`

3. **获取 API Keys**
   - 点击页面右上角的 **API Keys** 链接
   - 或直接访问：Settings → API Keys

---

## 🔑 需要获取的信息

### 1. Project URL（项目URL）

**位置：**
- Data API 页面顶部
- 或 API Keys 页面

**格式：**
```
https://cghyvbwmijqpahnoduyv.supabase.co
```

**用途：**
- 用于连接 Supabase 客户端
- 环境变量：`NEXT_PUBLIC_SUPABASE_URL`

---

### 2. anon public key（公开密钥）

**位置：**
- Settings → API Keys 页面
- 标记为 "anon" 或 "public"

**特点：**
- ✅ 可以公开使用（前端代码）
- ✅ 受 RLS (Row Level Security) 保护
- ✅ 安全，不会泄露敏感数据

**用途：**
- 前端应用使用
- 环境变量：`NEXT_PUBLIC_SUPABASE_ANON_KEY`

**示例：**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaHl2YndtaWpxcGFobm9kdXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTY4NzY1MjAsImV4cCI6MjAzMjQ1MjUyMH0.xxxxx
```

---

### 3. service_role key（服务密钥）⚠️

**位置：**
- Settings → API Keys 页面
- 标记为 "service_role"

**特点：**
- ⚠️ **绝密！** 不要暴露在前端
- ⚠️ 绕过 RLS，拥有完整权限
- ⚠️ 只在服务器端使用

**用途：**
- 后端 API 路由使用
- 管理员操作
- 环境变量：`SUPABASE_SERVICE_ROLE_KEY`（不要加 NEXT_PUBLIC_）

**示例：**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnaHl2YndtaWpxcGFobm9kdXl2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNjg3NjUyMCwiZXhwIjoyMDMyNDUyNTIwfQ.xxxxx
```

---

## 📝 创建 .env.local 文件

### 步骤1：创建文件

在项目根目录（`C:\Users\sangsong\atockorea`）创建 `.env.local` 文件

**Windows 方法：**
1. 在项目文件夹中，右键 → 新建 → 文本文档
2. 重命名为 `.env.local`（注意前面的点）
3. 如果提示"更改扩展名"，选择"是"

**或者使用命令行：**
```powershell
New-Item -Path .env.local -ItemType File
```

### 步骤2：添加内容

打开 `.env.local` 文件，添加以下内容：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://cghyvbwmijqpahnoduyv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_public_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

# 应用URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**替换说明：**
- `https://cghyvbwmijqpahnoduyv.supabase.co` → 你的 Project URL
- `你的anon_public_key` → 从 API Keys 页面复制的 anon public key
- `你的service_role_key` → 从 API Keys 页面复制的 service_role key

### 步骤3：保存文件

保存 `.env.local` 文件

---

## ✅ 验证配置

### 检查文件位置

确保 `.env.local` 在项目根目录：
```
atockorea/
  ├── .env.local          ← 这里
  ├── app/
  ├── components/
  ├── package.json
  └── ...
```

### 检查文件内容

`.env.local` 应该包含：
- ✅ `NEXT_PUBLIC_SUPABASE_URL=`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
- ✅ `SUPABASE_SERVICE_ROLE_KEY=`
- ✅ `NEXT_PUBLIC_APP_URL=`

### 重启开发服务器

```bash
# 停止当前服务器（Ctrl+C）
# 然后重新启动
npm run dev
```

---

## 🖼️ 截图指引

### 在 Supabase Dashboard 中：

1. **左侧菜单** → 点击 **Settings**（⚙️ 图标）
2. **Settings 子菜单** → 点击 **API Keys**
3. **API Keys 页面** → 你会看到：
   - Project URL（在顶部或 Data API 页面）
   - anon public key（可以复制）
   - service_role key（可以复制，有"Reveal"按钮）

---

## ⚠️ 重要提示

### 安全注意事项

1. **不要提交 .env.local 到 Git**
   - ✅ 已在 `.gitignore` 中（`.env*.local`）
   - ✅ 不会意外提交

2. **service_role key 保密**
   - ⚠️ 不要在前端代码中使用
   - ⚠️ 不要分享给他人
   - ⚠️ 只在服务器端 API 路由中使用

3. **anon public key 可以公开**
   - ✅ 可以用于前端代码
   - ✅ 受 RLS 保护，安全

---

## 🆘 常见问题

### Q: 找不到 API Keys 选项？

**A:** 
- 确保你在正确的项目
- 左侧菜单 → Settings → API Keys
- 如果还是没有，检查你的账户权限

### Q: service_role key 显示为 "Reveal"？

**A:** 
- 点击 "Reveal" 按钮
- 会显示完整的密钥
- 复制完整密钥

### Q: .env.local 文件不生效？

**A:** 
1. 检查文件是否在项目根目录
2. 检查文件名是否正确（`.env.local`，不是 `.env.local.txt`）
3. 重启开发服务器
4. 检查环境变量名称是否正确（注意大小写）

### Q: 如何验证配置是否正确？

**A:** 
1. 访问 `http://localhost:3000`
2. 如果页面正常加载，说明连接成功
3. 检查浏览器控制台是否有错误

---

## 📚 下一步

配置完成后：

1. ✅ 执行 SQL 脚本（`supabase/complete-schema.sql`）
2. ✅ 创建管理员账户
3. ✅ 测试系统功能

详细步骤请参考：`docs/SUPABASE_COMPLETE_SETUP.md`

