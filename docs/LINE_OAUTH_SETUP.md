# LINE OAuth 配置详细步骤

## 📋 概述

⚠️ **重要：** Supabase 不直接支持 LINE OAuth，我们使用**自定义实现**。

配置 LINE OAuth 登录，让用户可以使用 LINE 账户登录 AtoCKorea。

**实现方式：**
- 自定义 API 路由处理 LINE OAuth 流程
- 在 Supabase 中创建用户
- 使用 magic link 或 localStorage 管理登录状态

---

## 🔧 步骤1：访问 LINE Developers

### 1.1 登录 LINE Developers

1. **访问 LINE Developers**
   - [https://developers.line.biz/](https://developers.line.biz/)

2. **登录**
   - 使用你的 LINE 账户登录
   - 如果没有账户，先注册

3. **进入 Console**
   - 登录后，点击 **"Console"** 或 **"콘솔"**

---

## 🔧 步骤2：创建 Provider

### 2.1 创建新 Provider

1. **进入 Providers**
   - 在 LINE Developers Console 中
   - 点击 **"Providers"** 或 **"프로바이더"**

2. **创建 Provider**
   - 点击 **"Create"** 或 **"생성"**
   - Provider name: `AtoCKorea`
   - 点击 **"Create"**

---

## 🔧 步骤3：创建 LINE Login Channel

### 3.1 添加 Channel

1. **在 Provider 中创建 Channel**
   - 进入你创建的 Provider
   - 点击 **"Add a channel"** 或 **"채널 추가"**

2. **选择 Channel 类型**
   - 选择 **"LINE Login"**
   - 点击 **"Next"**

3. **填写 Channel 信息**
   - Channel name: `AtoCKorea Web`
   - Channel description: `AtoCKorea Web Application`
   - App type: **Web app**
   - Email address: 你的邮箱
   - 点击 **"Create"**

---

## 🔧 步骤4：配置 Channel 设置

### 4.1 进入 Channel 设置

1. **打开 Channel**
   - 在 Provider 中，点击你创建的 LINE Login Channel

2. **进入 Basic settings**
   - 在 Channel 页面中
   - 找到 **"Basic settings"** 或 **"기본 설정"**

### 4.2 配置 Callback URL

1. **找到 Callback URL 设置**
   - 在 Basic settings 页面中
   - 找到 **"Callback URL"** 或 **"콜백 URL"**

2. **添加 Callback URL**
   - 点击 **"Add"** 或 **"추가"**
   - 输入：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
   - 点击 **"Save"** 或 **"저장"**

---

## 🔧 步骤5：获取 Channel ID 和 Channel Secret

### 5.1 查看 Basic settings

1. **在 Channel 的 Basic settings 页面**
   - 你会看到：

2. **Channel ID**
   - 显示在页面顶部
   - 格式：数字（如：`1234567890`）
   - ⚠️ **重要：** 复制这个 ID

3. **Channel Secret**
   - 显示在 Channel ID 下方
   - 格式：字符串（如：`abcdef1234567890abcdef1234567890`）
   - ⚠️ **重要：** 立即复制 Channel Secret

---

## 🔧 步骤6：配置环境变量（自定义实现）

⚠️ **重要：** Supabase 不直接支持 LINE OAuth，我们使用自定义实现。

### 6.1 在 `.env.local` 中添加 LINE 配置

在项目根目录的 `.env.local` 文件中，添加：

```env
# LINE OAuth 配置（自定义实现）
LINE_CHANNEL_ID=你的LINE_Channel_ID
LINE_CHANNEL_SECRET=你的LINE_Channel_Secret
```

**说明：**
- `LINE_CHANNEL_ID`: 你的 LINE Channel ID（数字）
- `LINE_CHANNEL_SECRET`: 你的 LINE Channel Secret（字符串）

### 6.2 配置 Callback URL

在 LINE Developers Console 中，Callback URL 应该设置为：

```
http://localhost:3000/auth/callback?provider=line
```

**生产环境：**
```
https://atockorea.com/auth/callback?provider=line
```

**注意：** 不是 Supabase 的 URL，而是你的应用 URL！

---

## ✅ 验证配置

### 检查清单

- [ ] LINE Provider 已创建
- [ ] LINE Login Channel 已创建
- [ ] Callback URL 已添加
- [ ] Channel ID 已复制
- [ ] Channel Secret 已复制
- [ ] Supabase 中已填写 Channel ID
- [ ] Supabase 中已填写 Channel Secret
- [ ] 已点击 "Save" 保存配置

### 测试登录

1. **访问登录页面**
   - `http://localhost:3000/signin`

2. **点击 "LINE" 按钮**
   - 应该跳转到 LINE 授权页面

3. **完成授权**
   - 选择 LINE 账户
   - 点击 "同意して続ける" (Agree and Continue)

4. **验证结果**
   - 应该自动返回应用
   - 自动创建用户账户
   - 自动跳转到 `/mypage`

---

## 🆘 常见问题

### Q: 找不到 "Create Provider"？

**A:**
- 确保已登录 LINE Developers Console
- 访问：https://developers.line.biz/console/

### Q: Channel ID 和 Channel Secret 在哪里？

**A:**
- 在 Channel 的 Basic settings 页面
- Channel ID 在页面顶部
- Channel Secret 在 Channel ID 下方

### Q: Callback URL 不匹配？

**A:**
确保两个地方的 URL 完全一致：
- LINE: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`
- Supabase: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`

**注意：**
- 必须完全一致（包括协议 https）
- 不能有多余的斜杠
- 不能有空格

### Q: 如何获取用户邮箱？

**A:**
1. 在 Channel 的 Basic settings 中
2. 找到 **"Email address permission"** 或 **"이메일 주소 권한"**
3. 启用邮箱权限
4. 用户授权时会请求邮箱权限

---

## 📝 快速参考

### LINE Developers 配置

```
Provider: AtoCKorea
Channel: LINE Login (Web app)
Callback URL:
  https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
```

### 环境变量配置

```
# .env.local
LINE_CHANNEL_ID=你的LINE_Channel_ID
LINE_CHANNEL_SECRET=你的LINE_Channel_Secret
```

### LINE Developers 配置

```
Callback URL:
  http://localhost:3000/auth/callback?provider=line (开发环境)
  https://atockorea.com/auth/callback?provider=line (生产环境)
```

---

## 🎯 配置流程总结

1. ✅ 创建 Provider
2. ✅ 创建 LINE Login Channel
3. ✅ 配置 Callback URL（应用 URL，不是 Supabase URL）
4. ✅ 获取 Channel ID 和 Channel Secret
5. ✅ 在 `.env.local` 中配置环境变量
6. ✅ 测试登录

**注意：** 不需要在 Supabase Dashboard 中配置 LINE，因为我们使用自定义实现。

---

## 🎉 完成！

配置完 LINE 后，所有四个 OAuth 提供商（Google、Facebook、Kakao、LINE）都已配置完成！

**注意：** LINE 使用自定义实现，与其他提供商不同。

现在可以：
1. ✅ 测试所有 OAuth 登录
2. ✅ 验证用户自动创建
3. ✅ 开始使用系统

---

## 📚 相关文档

- `docs/LINE_OAUTH_CUSTOM_IMPLEMENTATION.md` - 自定义实现详细说明
- `app/api/auth/line/route.ts` - LINE OAuth API 路由代码

祝你使用愉快！🎉

