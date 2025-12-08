# 验证码系统快速设置指南

## 🚀 快速开始

### 步骤1：创建数据库表

1. **打开 Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - 选择你的项目

2. **打开 SQL Editor**
   - 左侧菜单 → **SQL Editor**
   - 点击 **New query**

3. **执行 SQL 脚本**
   - 复制 `docs/VERIFICATION_CODE_DATABASE.sql` 文件中的所有内容
   - 粘贴到 SQL Editor
   - 点击 **Run** 或按 `Ctrl+Enter`

4. **验证表已创建**
   - 左侧菜单 → **Table Editor**
   - 应该能看到 `verification_codes` 表

---

### 步骤2：配置邮件服务（Resend）

#### 2.1 注册 Resend

1. 访问 [https://resend.com](https://resend.com)
2. 点击 **Sign Up** 注册
3. 验证邮箱

#### 2.2 获取 API Key

1. 登录 Resend Dashboard
2. 点击 **API Keys**（左侧菜单）
3. 点击 **Create API Key**
4. 输入名称：`AtoCKorea Production`
5. 选择权限：**Sending access**
6. 点击 **Add**
7. **复制 API Key**（只显示一次，请保存好）

#### 2.3 配置域名和发送者邮箱

**详细步骤请参考：** `docs/RESEND_DOMAIN_SETUP.md`

**快速步骤：**

1. **添加域名**
   - Resend Dashboard → **Domains**
   - 点击 **Add Domain**
   - 输入：`atockorea.com`
   - 点击 **Add**

2. **查看 DNS 记录要求**
   - Resend 会显示需要添加的 DNS 记录
   - 通常包括：
     - TXT 记录（域名验证）
     - CNAME 记录（SPF/DKIM）
   - **复制这些记录的值**

3. **在域名注册商添加 DNS 记录**
   - 登录你的域名注册商（GoDaddy、Namecheap、Cloudflare 等）
   - 进入 DNS 管理页面
   - 添加 Resend 提供的 DNS 记录
   - 保存更改

4. **等待验证**
   - DNS 传播通常需要 **5-30 分钟**
   - 最长可能需要 **24 小时**
   - 在 Resend Dashboard 中检查验证状态
   - 状态显示为 **"Verified"** 即表示成功

5. **设置发送者邮箱**
   - 验证域名后，可以使用 `support@atockorea.com` 作为发送者
   - 无需额外配置

#### 2.4 配置环境变量

在项目根目录的 `.env.local` 文件中添加：

```env
RESEND_API_KEY=re_你的API_Key
```

**生产环境（Vercel）：**
1. Vercel Dashboard → 你的项目 → **Settings** → **Environment Variables**
2. 添加：
   - Key: `RESEND_API_KEY`
   - Value: 你的 Resend API Key
3. 点击 **Save**

---

### 步骤3：安装依赖（如果还没有）

```bash
npm install resend
```

---

### 步骤4：测试

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **访问注册页面**
   - `http://localhost:3000/signup`

3. **测试验证码发送**
   - 输入邮箱地址
   - 点击 "Send Verification Code"
   - 检查邮箱（或开发环境控制台）查看验证码

4. **测试验证码验证**
   - 输入收到的验证码
   - 点击 "Verify"
   - 应该能进入下一步

---

## 📧 邮件内容

邮件将包含以下内容：

**主题：** AtoCKorea Verification Code

**内容：**
- 英文：AtoCKorea sent you a verification code, please confirm: [6位数字]
- 验证码有效期：10分钟
- 发送者：support@atockorea.com

---

## ✅ 检查清单

- [ ] 数据库表 `verification_codes` 已创建
- [ ] Resend 账户已注册
- [ ] Resend API Key 已获取
- [ ] 域名 `atockorea.com` 已在 Resend 中验证
- [ ] 环境变量 `RESEND_API_KEY` 已配置
- [ ] `resend` 包已安装
- [ ] 测试发送验证码成功
- [ ] 测试验证验证码成功

---

## 🆘 常见问题

### Q: 验证码表创建失败？

**A:**
- 确保在 Supabase SQL Editor 中执行
- 检查是否有足够的数据库权限
- 查看错误信息，可能需要手动创建表

### Q: 邮件发送失败？

**A:**
1. **检查 Resend API Key**
   - 确保已正确配置在 `.env.local` 中
   - 重启开发服务器

2. **检查域名验证**
   - 确保域名已在 Resend 中验证
   - 检查 DNS 记录是否正确

3. **开发环境测试**
   - 开发环境会在控制台输出验证码
   - 检查浏览器控制台或服务器日志

### Q: 验证码验证失败？

**A:**
- 确保验证码未过期（10分钟）
- 确保验证码未使用过
- 检查数据库连接是否正常

---

## 🎉 完成！

配置完成后，signup 页面将：
1. ✅ 发送真正的验证码（不是链接）
2. ✅ 邮件内容为 "AtoCKorea sent you a verification code, please confirm"
3. ✅ 发送者邮箱为 support@atockorea.com

祝你使用愉快！🎉

