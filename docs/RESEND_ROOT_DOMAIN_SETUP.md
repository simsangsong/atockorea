# Resend 使用根域名接收邮件（无需额外费用）

## 📋 概述

如果 Resend 添加子域名需要收费，可以直接使用已添加的根域名 `atockorea.com` 来接收邮件。只需要添加 Enable Receiving MX 记录即可。

---

## ✅ 解决方案：使用根域名接收邮件

### 优点：
- ✅ 无需额外费用（使用已添加的域名）
- ✅ 邮件地址更短：`support@atockorea.com`
- ✅ 设置更简单

### 缺点：
- ⚠️ 会覆盖根域名现有的邮件接收设置
- ⚠️ 如果之前使用其他邮件服务，需要迁移

---

## 🎯 设置步骤

### 步骤 1：在 Resend 中启用邮件接收

1. **登录 Resend Dashboard**
   - 访问 https://resend.com
   - 登录你的账户

2. **进入域名设置**
   - 左侧菜单 → **Domains**
   - 点击 `atockorea.com` 域名

3. **启用 Enable Receiving**
   - 找到 **"Enable Receiving"** 部分
   - 打开开关（Toggle ON）

4. **查看 MX 记录要求**
   - Resend 会显示需要添加的 MX 记录
   - 记录应该是：
     - **Type:** MX
     - **Name:** `@`
     - **Content:** `inbound-smtp.ap-northeast-1.amazonaws.com`（或类似）
     - **Priority:** `9`

---

### 步骤 2：在 Namecheap 中添加 Enable Receiving MX 记录

1. **登录 Namecheap**
   - 访问 https://www.namecheap.com
   - 登录你的账户

2. **进入 DNS 管理**
   - Domain List → `atockorea.com` → Manage → Advanced DNS

3. **使用 Custom MX 选项**
   - 在 Mail Settings 部分，选择 **"Custom MX"**

4. **添加 MX 记录**
   - **Host:** `@`
   - **Value:** 从 Resend Dashboard 复制完整的 Content 值
     - 例如：`inbound-smtp.ap-northeast-1.amazonaws.com`
   - **Priority:** `9`
   - **TTL:** Automatic

5. **保存**
   - 点击 **"SAVE ALL CHANGES"**

---

### 步骤 3：验证 DNS 记录

1. **等待 DNS 传播**
   - 通常需要 5-30 分钟
   - 最长可能需要 24 小时

2. **在 Resend Dashboard 验证**
   - 返回 Resend Dashboard → Domains → `atockorea.com`
   - 点击 **"Verify DNS Records"** 按钮
   - 查看 Enable Receiving MX 记录的状态：
     - ✅ **Verified** - 验证成功
     - ⏳ **Pending** - 等待验证
     - ❌ **Not Started** - 验证失败（检查记录）

---

## 📊 需要添加的完整记录清单

### 发送邮件需要（必需）：

1. ✅ **Domain Verification (DKIM) - TXT 记录**
   - Host: `resend._domainkey`
   - Type: `TXT Record`

2. ✅ **Enable Sending SPF - TXT 记录**
   - Host: `send`
   - Type: `TXT Record`

3. ⚠️ **Enable Sending MX 记录**（可选但推荐）
   - Host: `send`
   - Type: `MX Record`
   - Priority: `10`

### 接收邮件需要（必需）：

4. ✅ **Enable Receiving MX 记录** ← **这个！**
   - Host: `@`
   - Type: `MX Record`
   - Priority: `9`

### 推荐添加：

5. ⚠️ **DMARC TXT 记录**
   - Host: `_dmarc`
   - Type: `TXT Record`
   - Value: `v=DMARC1; p=none;`

---

## ⚠️ 重要注意事项

### 1. 会覆盖现有邮件设置

当你添加 `@` 的 MX 记录后：
- ✅ 所有发送到 `@atockorea.com` 的邮件会路由到 Resend
- ⚠️ **会覆盖**现有的邮件接收设置
- ⚠️ 如果之前使用 Gmail、Outlook 等，需要迁移邮件

### 2. 邮件地址

使用根域名后，可以接收：
- ✅ `support@atockorea.com`
- ✅ `info@atockorea.com`
- ✅ `任何名称@atockorea.com`

### 3. 如果之前有其他邮件服务

**迁移建议：**
1. 先备份重要邮件
2. 添加 Resend MX 记录
3. 配置邮件转发（如果需要）
4. 通知用户新的邮件设置

---

## 🔧 完整设置流程

```
Resend Dashboard
  ↓
Domains → atockorea.com
  ↓
Enable Receiving (Toggle ON)
  ↓
查看 MX 记录要求
  ↓
Namecheap Advanced DNS
  ↓
Custom MX
  ↓
添加 MX 记录
  Host: @
  Value: inbound-smtp.ap-northe...
  Priority: 9
  ↓
保存
  ↓
等待 DNS 传播（5-30 分钟）
  ↓
在 Resend Dashboard 验证
  ↓
完成！
```

---

## ✅ 完成检查清单

- [ ] 在 Resend 中启用了 Enable Receiving（`atockorea.com`）
- [ ] 在 Namecheap 中添加了 Enable Receiving MX 记录（Host: `@`, Priority: `9`）
- [ ] 已保存所有更改
- [ ] 等待 DNS 传播（5-30 分钟）
- [ ] 在 Resend Dashboard 验证 MX 记录状态为 "Verified"
- [ ] 测试发送邮件到 `support@atockorea.com`
- [ ] 在 `/admin/emails` 查看收到的邮件

---

## 🎯 总结

**使用根域名接收邮件的优势：**
- ✅ 无需额外费用
- ✅ 邮件地址更短更专业
- ✅ 设置简单

**需要注意：**
- ⚠️ 会覆盖现有邮件设置
- ⚠️ 需要迁移之前的邮件（如果有）

**只需要添加一条 MX 记录：**
- Host: `@`
- Value: `inbound-smtp.ap-northeast-1.amazonaws.com`
- Priority: `9`

这样就能接收发送到 `support@atockorea.com` 的邮件了！🎉

