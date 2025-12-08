# Resend 完整邮件设置指南（接收 + 发送）

## 📋 概述

如果你需要**同时接收和发送邮件**到 `support@atockorea.com`，需要配置以下所有记录：

---

## ✅ 完整记录清单

### 1. Domain Verification (DKIM) - **必需** ✅
**用途：** 域名验证，证明你拥有这个域名

- **Type:** `TXT Record`
- **Host:** `resend._domainkey`
- **Value:** 从 Resend Dashboard 复制完整的 Content 值
- **TTL:** Automatic

**在 Namecheap 添加：**
1. Type 选择 `TXT Record`
2. Host 输入 `resend._domainkey`
3. Value 粘贴完整的 Content 值
4. 保存

---

### 2. Enable Sending - SPF TXT 记录 - **必需** ✅
**用途：** 允许 Resend 代表你的域名发送邮件

- **Type:** `TXT Record`
- **Host:** `send`
- **Value:** 从 Resend Dashboard 复制完整的 Content 值（通常是 `v=spf1 include:amazons...`）
- **TTL:** Automatic

**在 Namecheap 添加：**
1. Type 选择 `TXT Record`
2. Host 输入 `send`
3. Value 粘贴完整的 Content 值
4. 保存

---

### 3. Enable Sending - MX 记录 - **可选但推荐** ⚠️
**用途：** 处理发送邮件的反馈（bounce、complaint 等）

- **Type:** `MX Record`
- **Host:** `send`
- **Value:** 从 Resend Dashboard 复制完整的 Content 值（通常是 `feedback-smtp.ap-north...`）
- **Priority:** `10`
- **TTL:** Automatic

**在 Namecheap 添加：**
1. 使用 **Custom MX** 选项（见之前的指南）
2. Host 输入 `send`
3. Value 粘贴完整的 Content 值
4. Priority 输入 `10`
5. 保存

**⚠️ 注意：** 如果 Custom MX 只能添加一条记录，可以：
- **方案 A：** 在 Custom MX 中添加接收邮件的 MX（`@`, Priority `9`），然后在 Host Records 部分添加发送邮件的 MX（`send`, Priority `10`）
- **方案 B：** 先添加接收邮件的 MX，发送邮件的 MX 可以稍后添加（不影响基本发送功能）

**详细指南：** 查看 `docs/RESEND_NAMECHEAP_MULTIPLE_MX.md`

---

### 4. Enable Receiving - MX 记录 - **接收邮件必需** ✅
**用途：** 接收发送到 `support@atockorea.com` 的邮件

- **Type:** `MX Record`
- **Host:** `@`
- **Value:** 从 Resend Dashboard 复制完整的 Content 值（通常是 `inbound-smtp.ap-northe...`）
- **Priority:** `9`
- **TTL:** Automatic

**在 Namecheap 添加：**
1. 使用 **Custom MX** 选项
2. Host 输入 `@`
3. Value 粘贴完整的 Content 值
4. Priority 输入 `9`
5. 保存

**⚠️ 重要提示：**
- 这个 MX 记录会**覆盖**你现有的邮件接收设置
- 如果之前使用其他邮件服务（如 Gmail、Outlook），添加这个记录后，邮件会路由到 Resend
- 建议使用子域名（如 `mail.atockorea.com`）来避免冲突

**⚠️ 如果 Custom MX 只能添加一条记录：**
- **优先添加这条记录**（接收邮件必需）
- 发送邮件的 MX 记录（`send`, Priority `10`）可以在 Host Records 部分添加，或稍后添加

---

### 5. DMARC TXT 记录 - **可选但推荐** ⚠️
**用途：** 防止邮件被伪造，提高邮件送达率

- **Type:** `TXT Record`
- **Host:** `_dmarc`
- **Value:** `v=DMARC1; p=none;`
- **TTL:** Automatic

**在 Namecheap 添加：**
1. Type 选择 `TXT Record`
2. Host 输入 `_dmarc`
3. Value 输入 `v=DMARC1; p=none;`
4. 保存

---

## 📊 记录总结表

| 记录类型 | Host | Type | 用途 | 必需性 |
|---------|------|------|------|--------|
| Domain Verification | `resend._domainkey` | TXT | 域名验证 | ✅ 必需 |
| Enable Sending SPF | `send` | TXT | 允许发送 | ✅ 必需 |
| Enable Sending MX | `send` | MX | 发送反馈 | ⚠️ 推荐 |
| **Enable Receiving MX** | `@` | MX | **接收邮件** | ✅ **必需（如果要接收）** |
| DMARC | `_dmarc` | TXT | 防伪造 | ⚠️ 推荐 |

---

## 🎯 回答你的问题

**Q: 如果我要接收和发送都要的话，是不是只填写这个 MX 值就可以了？**

**A: 不是！** 需要配置以下所有记录：

### 发送邮件需要：
1. ✅ Domain Verification (DKIM) TXT 记录
2. ✅ Enable Sending SPF TXT 记录
3. ⚠️ Enable Sending MX 记录（推荐）

### 接收邮件需要：
4. ✅ **Enable Receiving MX 记录**（你看到的这个）

### 推荐添加：
5. ⚠️ DMARC TXT 记录

---

## ⚠️ 重要注意事项

### 1. Enable Receiving MX 记录的影响

当你添加 `@` 的 MX 记录后：
- ✅ 所有发送到 `@atockorea.com` 的邮件会路由到 Resend
- ⚠️ **会覆盖**现有的邮件接收设置
- ⚠️ 如果之前使用 Gmail、Outlook 等，需要迁移邮件

### 2. 使用根域名（推荐，无需额外费用）

**如果 Resend 添加子域名需要收费，直接使用根域名：**

**方案 A：使用根域名接收邮件** ✅ **推荐（无需额外费用）**
- 使用已添加的 `atockorea.com` 域名
- 在 Resend 中启用 Enable Receiving
- 添加 MX 记录：
  - Host: `@`
  - Value: `inbound-smtp.ap-northe...`
  - Priority: `9`

**详细指南：** 查看 `docs/RESEND_ROOT_DOMAIN_SETUP.md`

**方案 B：使用子域名（需要额外费用）**
- 创建 `mail.atockorea.com` 子域名（如果 Resend 支持且免费）
- 添加 MX 记录：
  - Host: `mail`
  - Value: `inbound-smtp.ap-northe...`
  - Priority: `9`

**详细指南：** 查看 `docs/RESEND_SUBDOMAIN_SETUP.md`

**⚠️ 注意：** 使用根域名会覆盖现有的邮件接收设置

---

## 📋 完整设置步骤

### 步骤 1：添加发送邮件所需的记录

1. ✅ Domain Verification (DKIM) TXT 记录
2. ✅ Enable Sending SPF TXT 记录
3. ⚠️ Enable Sending MX 记录（可选）

### 步骤 2：添加接收邮件所需的记录

4. ✅ **Enable Receiving MX 记录**（你看到的这个）

### 步骤 3：添加推荐记录

5. ⚠️ DMARC TXT 记录

### 步骤 4：等待验证

- 等待 5-30 分钟让 DNS 传播
- 在 Resend Dashboard 点击 **"Verify DNS Records"**
- 确认所有记录状态为 **"Verified"**

---

## ✅ 完成检查清单

- [ ] Domain Verification (DKIM) TXT 记录已添加
- [ ] Enable Sending SPF TXT 记录已添加
- [ ] Enable Sending MX 记录已添加（可选）
- [ ] **Enable Receiving MX 记录已添加**（你看到的这个）
- [ ] DMARC TXT 记录已添加（可选）
- [ ] 所有记录已保存
- [ ] 等待 5-30 分钟
- [ ] 在 Resend Dashboard 验证所有记录
- [ ] 所有记录状态为 "Verified"

---

## 🎯 总结

**要同时接收和发送邮件，需要配置：**

1. ✅ **发送邮件：** DKIM TXT + SPF TXT + (可选) Sending MX
2. ✅ **接收邮件：** **Receiving MX**（你看到的这个）
3. ⚠️ **推荐：** DMARC TXT

**只添加 Receiving MX 记录是不够的！** 还需要添加发送邮件所需的记录。

祝你设置顺利！🎉

