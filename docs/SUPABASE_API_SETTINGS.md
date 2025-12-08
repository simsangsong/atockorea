# Supabase API 设置指南

## 当前设置检查

根据你的截图，你的 Supabase Data API 设置如下：

### ✅ 已正确配置

1. **Project URL**: `https://cghyvbwmijqpahnoduyv.supabase.co`
   - 这是你的 Supabase 项目 URL
   - 用于连接数据库

2. **Enable Data API**: ✅ **已启用（绿色）**
   - ✅ **正确！** 必须启用才能使用 Supabase 客户端库

3. **Exposed schemas**: 
   - ✅ `PUBLIC` - **必需！** 我们的所有表都在 public schema
   - `GRAPHQL_PUBLIC` - GraphQL 相关（可选）

4. **Extra search path**: 
   - ✅ `PUBLIC` - **正确**
   - `EXTENSIONS` - 扩展相关（可选）

5. **Max rows**: `1000`
   - ✅ **合理** - 防止返回过多数据

6. **Pool size**: 自动配置
   - ✅ **正确** - 让系统自动管理

---

## 下一步：获取 API Keys

### 步骤1：获取 API Keys

1. 在 Supabase Dashboard 左侧菜单，点击 **Settings** → **API**
2. 你会看到以下信息：

#### Project URL
```
https://cghyvbwmijqpahnoduyv.supabase.co
```
**用途：** 用于连接 Supabase 客户端

#### API Keys

**anon public** (公开密钥)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ✅ **可以公开** - 用于前端应用
- 受 RLS (Row Level Security) 保护
- 用于：`NEXT_PUBLIC_SUPABASE_ANON_KEY`

**service_role** (服务密钥) ⚠️ **保密！**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- ⚠️ **绝密！** 不要暴露在前端代码中
- 绕过 RLS，拥有完整权限
- 用于：`SUPABASE_SERVICE_ROLE_KEY`（仅后端）

---

## 配置环境变量

### 步骤2：更新 `.env.local`

在项目根目录的 `.env.local` 文件中，添加/更新以下内容：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://cghyvbwmijqpahnoduyv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_public_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

# 应用URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**重要提示：**
- ✅ `NEXT_PUBLIC_SUPABASE_URL` - 使用你的 Project URL
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY` - 使用 `anon public` key
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` - 使用 `service_role` key（保密！）

---

## 验证配置

### 步骤3：测试连接

1. **重启开发服务器**
   ```bash
   # 停止当前服务器（Ctrl+C）
   npm run dev
   ```

2. **检查连接**
   - 访问：`http://localhost:3000`
   - 如果页面正常加载，说明连接成功！

3. **测试数据库**
   - 在 Supabase Dashboard → **Table Editor**
   - 应该能看到所有11个表

---

## 设置说明

### Data API 设置详解

#### Enable Data API
- **必须启用** ✅
- 允许使用 Supabase 客户端库
- 启用 RESTful API 端点

#### Exposed schemas
- **PUBLIC** - 必须包含 ✅
  - 我们的所有表（tours, bookings, merchants等）都在 public schema
- **GRAPHQL_PUBLIC** - 可选
  - 如果使用 GraphQL 才需要

#### Extra search path
- **PUBLIC** - 推荐 ✅
  - 确保查询能找到表
- **EXTENSIONS** - 可选
  - 用于 PostgreSQL 扩展

#### Max rows
- **1000** - 合理 ✅
  - 防止返回过多数据
  - 可以按需调整（建议 100-10000）

#### Pool size
- **自动配置** - 推荐 ✅
  - 系统会根据计算资源自动调整
  - 通常不需要手动设置

---

## 安全建议

### ✅ 已正确配置

1. **RLS (Row Level Security)** - 已启用
   - 所有表都有 RLS 策略
   - 保护数据安全

2. **API Keys 分离**
   - `anon public` - 前端使用（受 RLS 保护）
   - `service_role` - 仅后端使用（完整权限）

3. **Max rows 限制**
   - 防止恶意请求返回大量数据

### ⚠️ 注意事项

1. **不要暴露 service_role key**
   - 只在服务器端使用
   - 不要提交到 Git

2. **检查 .gitignore**
   - 确保 `.env.local` 在 `.gitignore` 中

3. **生产环境**
   - 使用环境变量管理工具（如 Vercel Environment Variables）
   - 不要硬编码密钥

---

## 常见问题

### Q: 需要修改这些设置吗？

**A:** 不需要！当前设置已经正确。只需要：
1. 确保 Data API 已启用 ✅（已启用）
2. PUBLIC schema 已暴露 ✅（已暴露）
3. 获取 API keys 并配置到 `.env.local`

### Q: Max rows 1000 够吗？

**A:** 对于大多数情况足够。如果：
- 需要返回更多数据 → 可以增加到 5000-10000
- 担心性能 → 保持 1000 或更少

### Q: 需要启用 GraphQL 吗？

**A:** 不需要。我们使用的是 REST API（通过 Supabase 客户端库）。

### Q: Pool size 需要调整吗？

**A:** 不需要。自动配置通常是最佳选择。

---

## 下一步

配置完成后：

1. ✅ **验证连接** - 访问 `http://localhost:3000`
2. ✅ **创建管理员** - 按照 `docs/SUPABASE_COMPLETE_SETUP.md` 的步骤6
3. ✅ **测试功能** - 访问总台和商家后台

---

## 快速检查清单

- [ ] Data API 已启用 ✅
- [ ] PUBLIC schema 已暴露 ✅
- [ ] 已获取 Project URL
- [ ] 已获取 anon public key
- [ ] 已获取 service_role key
- [ ] 已配置 `.env.local`
- [ ] 已重启开发服务器
- [ ] 可以访问 `http://localhost:3000`

如果所有项都完成，你就可以开始使用系统了！🎉

