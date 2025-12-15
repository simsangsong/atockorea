# 环境变量配置说明 - 本地 vs 生产环境

## ⚠️ 重要概念

### 本地环境变量 vs 生产环境变量

**它们是分开的！** 本地和生产环境需要分别配置环境变量。

---

## 📋 两种环境

### 1. 本地开发环境（你的电脑）

**文件：** `.env.local`（在你的项目文件夹中）

**用途：**
- ✅ 本地开发时使用（`npm run dev`）
- ✅ 测试功能
- ❌ **主机关机后无法使用**

**特点：**
- 只存在于你的电脑上
- 主机关机后，本地服务器停止
- 不会影响生产环境

---

### 2. 生产环境（Vercel 云端服务器）

**位置：** Vercel Dashboard → Settings → Environment Variables（Web 界面）

**⚠️ 重要：** Vercel **不需要 `.env` 文件**！通过 Web 界面配置。

**用途：**
- ✅ 生产网站使用（`https://atockorea.com`）
- ✅ 24/7 运行
- ✅ **即使你的电脑关机，生产环境仍然运行**

**特点：**
- 存储在 Vercel 的云端服务器
- 独立于你的电脑
- 主机关机不影响生产环境
- **不会出现在代码中**（因为 `.env.local` 在 `.gitignore` 中）

**详细配置步骤：** 查看 `docs/VERCEL_ENV_VARIABLES_SETUP.md`

---

## 🎯 回答你的问题

### Q: 如果所有环境变量都存到本地，主机关机后是不是都用不了？

**A: 分两种情况：**

#### 情况 1：只在本地配置了环境变量

❌ **主机关机后：**
- 本地开发服务器停止
- 本地环境变量无法使用
- **但是生产环境（Vercel）仍然运行！**
- 生产环境使用 Vercel 中配置的环境变量

#### 情况 2：在 Vercel 中也配置了环境变量

✅ **主机关机后：**
- 本地开发服务器停止（不影响）
- 生产环境（Vercel）继续运行
- 生产环境使用 Vercel 中的环境变量
- **所有功能正常工作！**

---

## ✅ 正确的配置方式

### 必须同时配置两个地方：

#### 1. 本地开发（`.env.local`）

```env
# Resend
RESEND_API_KEY=re_你的API_Key
RESEND_WEBHOOK_SECRET=你的Webhook_Secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名Key
SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色Key

# Stripe (결제)
STRIPE_SECRET_KEY=sk_test_你的Stripe密钥
STRIPE_WEBHOOK_SECRET=whsec_你的Webhook密钥
STRIPE_PUBLISHABLE_KEY=pk_test_你的Publishable密钥 (선택사항, 클라이언트용)
```

**用途：** 本地开发测试

#### 2. Vercel 生产环境

在 Vercel Dashboard → Settings → Environment Variables 中添加：

| Key | Value | Environment |
|-----|-------|-------------|
| `RESEND_API_KEY` | `re_你的API_Key` | Production, Preview, Development |
| `RESEND_WEBHOOK_SECRET` | `你的Webhook_Secret` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `你的Service_Role_Key` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_URL` | `你的Supabase项目URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `你的Supabase匿名Key` | Production, Preview, Development |

**用途：** 生产网站运行

---

## 🔧 配置步骤

### 步骤 1：配置本地环境变量

1. **在项目根目录创建 `.env.local` 文件**
   ```bash
   # 如果文件不存在，创建它
   touch .env.local
   ```

2. **添加所有环境变量**
   ```env
   RESEND_API_KEY=re_你的API_Key
   RESEND_WEBHOOK_SECRET=你的Webhook_Secret
   NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名Key
   SUPABASE_SERVICE_ROLE_KEY=你的Supabase服务角色Key
   ```

3. **重启开发服务器**
   ```bash
   npm run dev
   ```

---

### 步骤 2：配置 Vercel 环境变量（重要！）

1. **登录 Vercel Dashboard**
   - 访问 https://vercel.com
   - 登录你的账户

2. **进入项目设置**
   - 选择你的项目（atockorea）
   - 点击 **Settings** 标签

3. **进入 Environment Variables**
   - 左侧菜单 → **Environment Variables**

4. **添加每个环境变量**
   - 点击 **"Add New"** 或 **"Add"** 按钮
   - 填写：
     - **Key:** `RESEND_API_KEY`
     - **Value:** `re_你的API_Key`（从本地复制）
     - **Environment:** 选择 Production, Preview, Development（全选）
   - 点击 **"Save"**

5. **重复步骤 4，添加所有环境变量**

6. **重新部署项目**
   - 环境变量更新后，需要重新部署
   - Vercel Dashboard → Deployments
   - 点击最新的部署 → **"..."** → **"Redeploy"**

---

## 📊 环境变量对比

| 配置位置 | 文件/位置 | 用途 | 主机关机影响 |
|---------|---------|------|------------|
| **本地开发** | `.env.local` | 本地测试 | ❌ 主机关机后无法使用（但生产环境不受影响） |
| **生产环境** | Vercel Dashboard | 生产网站 | ✅ 主机关机后仍然可用 |

---

## ⚠️ 重要提示

### 1. 必须配置两个地方

- ✅ 本地 `.env.local` - 用于开发
- ✅ Vercel Environment Variables - 用于生产

### 2. 主机关机的影响

**本地开发：**
- ❌ 主机关机后，本地服务器停止
- ❌ 无法在本地测试

**生产环境：**
- ✅ 主机关机后，Vercel 服务器继续运行
- ✅ 网站仍然可以访问
- ✅ 所有功能正常工作（使用 Vercel 中的环境变量）

### 3. 环境变量值应该相同

- 本地和生产环境使用相同的值
- 但需要分别配置
- 不能只配置一个地方

---

## ✅ 完成检查清单

### 本地配置

- [ ] `.env.local` 文件已创建
- [ ] 所有环境变量已添加到 `.env.local`
- [ ] 开发服务器已重启
- [ ] 本地功能测试正常

### Vercel 配置

- [ ] 已登录 Vercel Dashboard
- [ ] 已进入项目 Settings → Environment Variables
- [ ] `RESEND_API_KEY` 已添加
- [ ] `RESEND_WEBHOOK_SECRET` 已添加（如果使用）
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已添加
- [ ] 其他 Supabase 变量已添加
- [ ] 所有变量 Environment 都选择了 Production
- [ ] 项目已重新部署

### 验证

- [ ] 生产网站可以访问（`https://atockorea.com`）
- [ ] 发送验证码功能正常
- [ ] 邮件接收功能正常（webhook）
- [ ] 主机关机后，生产环境仍然正常工作

---

## 🎯 总结

**关键点：**

1. ✅ **本地环境变量**（`.env.local`）- 只用于本地开发
2. ✅ **Vercel 环境变量**（Dashboard）- 用于生产环境
3. ✅ **必须配置两个地方**
4. ✅ **主机关机不影响生产环境**（Vercel 是云端服务）

**主机关机后：**
- ❌ 本地开发服务器停止
- ✅ 生产环境（Vercel）继续运行
- ✅ 网站功能正常（使用 Vercel 中的环境变量）

---

## 🆘 常见问题

### Q: 我只配置了本地，生产环境能用吗？

**A:** ❌ 不能！必须在 Vercel 中也配置环境变量。

### Q: 主机关机后，生产环境还能用吗？

**A:** ✅ 可以！Vercel 是云端服务，独立于你的电脑。

### Q: 本地和生产环境变量值要一样吗？

**A:** ✅ 是的，应该使用相同的值（但需要分别配置）。

### Q: 如何确认 Vercel 环境变量已配置？

**A:**
1. Vercel Dashboard → Settings → Environment Variables
2. 查看变量列表
3. 确认所有必需变量都已添加

---

祝你配置顺利！🎉

