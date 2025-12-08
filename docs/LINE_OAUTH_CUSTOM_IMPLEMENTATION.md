# LINE OAuth 自定义实现说明

## 📋 概述

由于 Supabase 不直接支持 LINE OAuth，我们实现了自定义的 LINE OAuth 登录流程。

---

## 🔧 实现方式

### 架构

```
用户点击 LINE 登录
    ↓
/api/auth/line (GET) → 重定向到 LINE 授权页面
    ↓
用户授权后，LINE 重定向回应用
    ↓
/auth/callback?provider=line&code=xxx
    ↓
调用 /api/auth/line/callback (POST)
    ↓
交换 code 获取 access token
    ↓
使用 access token 获取用户信息
    ↓
在 Supabase 中创建/查找用户
    ↓
返回用户信息，前端处理登录
```

---

## 📝 配置步骤

### 步骤1：在 LINE Developers 中配置

1. **创建 Provider 和 Channel**
   - 参考 `docs/LINE_OAUTH_SETUP.md`

2. **配置 Callback URL**
   ```
   http://localhost:3000/auth/callback?provider=line (开发环境)
   https://atockorea.com/auth/callback?provider=line (生产环境)
   ```

3. **获取 Channel ID 和 Channel Secret**

---

### 步骤2：配置环境变量

在 `.env.local` 中添加：

```env
# LINE OAuth 配置
LINE_CHANNEL_ID=你的LINE_Channel_ID
LINE_CHANNEL_SECRET=你的LINE_Channel_Secret

# 应用 URL（用于 Callback）
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**生产环境（Vercel）：**
- 在 Vercel Dashboard → Settings → Environment Variables 中添加
- `NEXT_PUBLIC_APP_URL=https://atockorea.com`

---

## 🔄 工作流程

### 1. 启动 OAuth 流程

**文件：** `app/api/auth/line/route.ts` (GET)

```typescript
// 用户点击 LINE 登录按钮
// 前端调用：window.location.href = '/api/auth/line'
// 重定向到 LINE 授权页面
```

### 2. LINE 回调

**文件：** `app/auth/callback/page.tsx`

```typescript
// LINE 重定向回：/auth/callback?provider=line&code=xxx
// 检测到 provider=line，调用自定义 API
```

### 3. 处理 OAuth 回调

**文件：** `app/api/auth/line/route.ts` (POST)

```typescript
// 1. 使用 code 交换 access token
// 2. 使用 access token 获取用户信息
// 3. 在 Supabase 中创建/查找用户
// 4. 返回用户信息
```

### 4. 前端登录处理

**文件：** `app/auth/callback/page.tsx`

```typescript
// 接收用户信息
// 尝试使用 magic link 自动登录
// 或存储用户信息到 localStorage
// 重定向到 /mypage
```

---

## ⚠️ 注意事项

### 1. Session 管理

由于无法直接创建 Supabase session，我们使用以下方式：

- **方案A：** 使用 magic link（推荐）
- **方案B：** 存储用户信息到 localStorage（临时方案）

### 2. 用户标识

LINE 用户使用以下格式的邮箱：
```
line_{userId}@line.local
```

例如：`line_1234567890@line.local`

### 3. 用户资料

LINE 用户创建时，会自动创建 `user_profiles` 记录：
- `full_name`: LINE 显示名称
- `avatar_url`: LINE 头像 URL

---

## 🧪 测试

### 1. 本地测试

```bash
# 1. 确保环境变量已配置
cat .env.local | grep LINE

# 2. 启动开发服务器
npm run dev

# 3. 访问登录页面
http://localhost:3000/signin

# 4. 点击 LINE 登录按钮
# 5. 完成 LINE 授权
# 6. 验证是否成功登录
```

### 2. 检查清单

- [ ] LINE Channel ID 和 Secret 已配置
- [ ] Callback URL 已正确设置
- [ ] 环境变量已加载
- [ ] 可以跳转到 LINE 授权页面
- [ ] 授权后可以返回应用
- [ ] 用户已创建/登录
- [ ] 可以访问 `/mypage`

---

## 🆘 常见问题

### Q: 为什么 LINE 登录后没有自动登录？

**A:**
- LINE OAuth 是自定义实现，无法直接创建 Supabase session
- 我们使用 magic link 或 localStorage 存储用户信息
- 如果 magic link 失败，用户信息会存储在 localStorage 中

### Q: 如何改进 LINE 登录体验？

**A:**
1. **使用 Supabase Edge Functions**（推荐）
   - 在 Edge Function 中处理 LINE OAuth
   - 使用 Supabase 的 session 管理

2. **使用 JWT Token**
   - 生成自定义 JWT token
   - 前端使用 token 验证身份

3. **等待 Supabase 官方支持**
   - 关注 Supabase 更新
   - 如果官方支持，迁移到官方实现

### Q: LINE 用户如何修改密码？

**A:**
- LINE 用户没有密码（使用 OAuth 登录）
- 如果需要密码，可以：
  1. 提示用户设置密码
  2. 使用 `supabase.auth.updateUser()` 设置密码

---

## 📚 相关文件

- `app/api/auth/line/route.ts` - LINE OAuth API 路由
- `app/auth/callback/page.tsx` - OAuth 回调处理
- `app/signin/page.tsx` - 登录页面（LINE 按钮）
- `app/signup/page.tsx` - 注册页面（LINE 按钮）
- `docs/LINE_OAUTH_SETUP.md` - LINE 配置步骤

---

## 🎯 未来改进

1. ✅ 实现自定义 LINE OAuth
2. ⏳ 改进 session 管理
3. ⏳ 添加错误处理
4. ⏳ 添加日志记录
5. ⏳ 支持 LINE 邮箱获取

---

## 🎉 完成！

LINE OAuth 自定义实现已完成！

现在可以：
1. ✅ 使用 LINE 登录
2. ✅ 自动创建用户
3. ✅ 访问用户中心

祝你使用愉快！🎉

