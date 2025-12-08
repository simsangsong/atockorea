# Resend 域名设置 - Namecheap 详细操作指南

## 📋 基于你的 Resend Dashboard 显示

根据你在 Resend Dashboard → Domains → atockorea.com 页面看到的记录，以下是具体的添加步骤。

---

## 🎯 需要添加的记录清单

从你的 Resend Dashboard 可以看到以下记录：

### 1. Domain Verification (DKIM) - **必需**
- **Type:** TXT
- **Name:** `resend._domainkey`
- **Content:** `p=MIGfMA0GCSqGSIb3DQEB...`（完整的长字符串）

### 2. Enable Sending (SPF) - **必需**
- **Type:** MX
- **Name:** `send`
- **Content:** `feedback-smtp.ap-north...`（完整值）
- **Priority:** `10`

- **Type:** TXT
- **Name:** `send`
- **Content:** `v=spf1 include:amazons...`（完整值）

### 3. DMARC (Optional) - **可选**
- **Type:** TXT
- **Name:** `_dmarc`
- **Content:** `v=DMARC1; p=none;`

### 4. Enable Receiving (MX) - **可选**（如果不需要接收邮件可跳过）
- **Type:** MX
- **Name:** `@`
- **Content:** `inbound-smtp.ap-northe...`（完整值）
- **Priority:** `9`

---

## 🔧 Namecheap 详细操作步骤

### 步骤 1：登录 Namecheap 并进入 DNS 管理

1. **登录 Namecheap**
   - 访问 [https://www.namecheap.com](https://www.namecheap.com)
   - 登录你的账户

2. **进入域名列表**
   - 点击顶部菜单 **"Domain List"**
   - 或访问：https://ap.www.namecheap.com/domains/list/

3. **选择域名**
   - 找到 `atockorea.com`
   - 点击域名旁边的 **"Manage"** 按钮

4. **进入 DNS 设置**
   - 在域名管理页面，点击 **"Advanced DNS"** 标签
   - 或直接访问：`https://ap.www.namecheap.com/domains/list/domain/controlpanel/atockorea.com/advancedns`

---

### 步骤 2：添加 Domain Verification (DKIM) TXT 记录

#### 2.1 准备记录信息

从 Resend Dashboard 复制：
- **Type:** TXT
- **Name:** `resend._domainkey`
- **Content:** 完整的 Content 值（从 `p=MIGfMA0GCSqGSIb3DQEB...` 开始）

#### 2.2 在 Namecheap 添加

1. **滚动到 "Host Records" 部分**
   - 在 Advanced DNS 页面找到 "Host Records" 或 "DNS Records" 部分

2. **点击 "Add New Record"**
   - 找到 **"Add New Record"** 按钮
   - 点击添加新记录

3. **选择记录类型**
   - 在 **"Type"** 下拉菜单中选择 **"TXT Record"**

4. **填写 Host 字段**
   - 在 **"Host"** 输入框中输入：`resend._domainkey`
   - ⚠️ **注意：** 只输入 `resend._domainkey`，不要包含域名

5. **填写 Value 字段**
   - 在 **"Value"** 输入框中粘贴完整的 Content 值
   - 从 Resend Dashboard 完整复制，包括所有字符
   - 例如：`p=MIGfMA0GCSqGSIb3DQEB...`（完整字符串）

6. **设置 TTL**
   - **"TTL"** 选择 **"Automatic"** 或 `3600`

7. **保存记录**
   - 点击 **"Save All Changes"** 或绿色对勾图标

---

### 步骤 3：添加 Enable Sending - MX 记录

#### 3.1 准备记录信息

从 Resend Dashboard 复制：
- **Type:** MX
- **Name:** `send`
- **Content:** `feedback-smtp.ap-north...`（完整值）
- **Priority:** `10`

#### 3.2 在 Namecheap 添加 MX 记录

**✅ 找到邮件设置部分了！**

从你的截图可以看到 Namecheap 的邮件服务配置选项。要添加自定义 MX 记录：

**方法 1：使用 Custom MX 选项（推荐）**

1. **找到邮件服务配置下拉菜单**
   - 在 Advanced DNS 页面查找邮件服务设置
   - 或查找 "Email Settings" / "Mail Settings" 部分

2. **选择 "Custom MX"**
   - 在下拉菜单中选择 **"Custom MX"**
   - 这会允许你添加自定义的 MX 记录

3. **添加 MX 记录**
   - 选择 "Custom MX" 后，会出现添加 MX 记录的界面
   - 填写以下信息：
     - **Host:** `send`
     - **Value:** 从 Resend Dashboard 复制的完整 Content 值
     - **Priority:** `10`
     - **TTL:** Automatic

4. **保存记录**

**方法 2：在 Host Records 部分添加**
1. 如果 "Custom MX" 选项不显示添加界面
2. 回到 "Host Records" 部分
3. 点击 "Add New Record"
4. 在 Type 下拉菜单中向下滚动查找 "MX Record"

#### 3.3 填写记录信息

1. **选择记录类型**
   - **"Type"** 选择 **"MX Record"** 或 **"MX"**

2. **填写 Host 字段**
   - **"Host"** 输入：`send`

3. **填写 Value 字段**
   - **"Value"** 输入完整的 Content 值
   - 例如：`feedback-smtp.ap-northeast-1.amazonses.com`（完整域名）

4. **填写 Priority 字段**
   - **"Priority"** 输入：`10`
   - ⚠️ **注意：** 某些界面可能将 Priority 称为 "Priority" 或 "Pref"

5. **设置 TTL**
   - **"TTL"** 选择 **"Automatic"** 或 `3600`

6. **保存记录**
   - 点击 **"Save All Changes"** 或绿色对勾图标

---

### 步骤 4：添加 Enable Sending - SPF TXT 记录

#### 4.1 准备记录信息

从 Resend Dashboard 复制：
- **Type:** TXT
- **Name:** `send`
- **Content:** `v=spf1 include:amazons...`（完整值）

#### 4.2 在 Namecheap 添加

1. **点击 "Add New Record"**

2. **选择记录类型**
   - **"Type"** 选择 **"TXT Record"**

3. **填写 Host 字段**
   - **"Host"** 输入：`send`

4. **填写 Value 字段**
   - **"Value"** 输入完整的 Content 值
   - 例如：`v=spf1 include:amazonses.com ~all`（完整字符串）

5. **设置 TTL**
   - **"TTL"** 选择 **"Automatic"** 或 `3600`

6. **保存记录**

---

### 步骤 5：添加 DMARC TXT 记录（可选）

#### 5.1 准备记录信息

从 Resend Dashboard 复制：
- **Type:** TXT
- **Name:** `_dmarc`
- **Content:** `v=DMARC1; p=none;`

#### 5.2 在 Namecheap 添加

1. **点击 "Add New Record"**

2. **选择记录类型**
   - **"Type"** 选择 **"TXT Record"**

3. **填写 Host 字段**
   - **"Host"** 输入：`_dmarc`

4. **填写 Value 字段**
   - **"Value"** 输入：`v=DMARC1; p=none;`

5. **设置 TTL**
   - **"TTL"** 选择 **"Automatic"** 或 `3600`

6. **保存记录**

---

### 步骤 6：添加 Enable Receiving - MX 记录（可选）

**注意：** 如果你只需要发送邮件，不需要接收邮件，可以跳过这一步。

#### 6.1 准备记录信息

从 Resend Dashboard 复制：
- **Type:** MX
- **Name:** `@`
- **Content:** `inbound-smtp.ap-northe...`（完整值）
- **Priority:** `9`

#### 6.2 在 Namecheap 添加 MX 记录

**✅ 使用 Custom MX 选项**

1. **找到邮件服务配置**
   - 在 Advanced DNS 页面查找邮件服务设置下拉菜单

2. **选择 "Custom MX"**
   - 在下拉菜单中选择 **"Custom MX"**
   - 这会允许你添加自定义的 MX 记录

3. **添加 MX 记录**
   - 选择 "Custom MX" 后，填写以下信息：
     - **Host:** `@`
     - **Value:** 从 Resend Dashboard 复制的完整 Content 值
     - **Priority:** `9`
     - **TTL:** Automatic

4. **保存记录**

#### 6.3 填写记录信息

1. **选择记录类型**
   - **"Type"** 选择 **"MX Record"** 或 **"MX"**

2. **填写 Host 字段**
   - **"Host"** 输入：`@`

3. **填写 Value 字段**
   - **"Value"** 输入完整的 Content 值
   - 例如：`inbound-smtp.ap-northeast-1.amazonaws.com`（完整域名）

4. **填写 Priority 字段**
   - **"Priority"** 输入：`9`

5. **设置 TTL**
   - **"TTL"** 选择 **"Automatic"** 或 `3600`

6. **保存记录**

---

## 📋 Namecheap 界面字段对应关系

| Resend Dashboard | Namecheap 字段 | 说明 |
|-----------------|---------------|------|
| **Type** | Type | 选择 TXT Record 或 MX Record |
| **Name** | Host | 填写主机名（如 `resend._domainkey`、`send`、`_dmarc`、`@`） |
| **Content** | Value | 完整的记录值 |
| **TTL** | TTL | 选择 Automatic 或 3600 |
| **Priority** | Priority | 仅 MX 记录需要（如 10、9） |

---

## ⚠️ 重要注意事项

### 1. 完整复制 Content 值

- **TXT 记录** 的 Content 可能很长（特别是 DKIM 记录）
- 必须完整复制，不要遗漏任何字符
- 包括所有特殊字符、等号、分号等

### 2. Host 字段填写规则

- **`resend._domainkey`** → 只输入 `resend._domainkey`
- **`send`** → 只输入 `send`
- **`_dmarc`** → 只输入 `_dmarc`
- **`@`** → 只输入 `@`
- ❌ **不要包含完整域名**（如 `resend._domainkey.atockorea.com`）

### 3. MX 记录的 Priority

- **Enable Sending MX** → Priority: `10`
- **Enable Receiving MX** → Priority: `9`
- 数字越小，优先级越高

### 4. 保存方式

- 可以逐条保存（每添加一条记录后保存）
- 或全部添加完成后，点击 **"Save All Changes"**

---

## ✅ 完成检查清单

添加所有记录后，确认：

- [ ] Domain Verification (DKIM) TXT 记录已添加
  - [ ] Host: `resend._domainkey`
  - [ ] Value: 完整的 Content 值

- [ ] Enable Sending MX 记录已添加
  - [ ] Host: `send`
  - [ ] Value: 完整的 Content 值
  - [ ] Priority: `10`

- [ ] Enable Sending SPF TXT 记录已添加
  - [ ] Host: `send`
  - [ ] Value: 完整的 Content 值

- [ ] DMARC TXT 记录已添加（可选）
  - [ ] Host: `_dmarc`
  - [ ] Value: `v=DMARC1; p=none;`

- [ ] Enable Receiving MX 记录已添加（可选）
  - [ ] Host: `@`
  - [ ] Value: 完整的 Content 值
  - [ ] Priority: `9`

- [ ] 所有记录已保存
- [ ] 等待 5-30 分钟让 DNS 传播

---

## 🔍 验证记录

### 步骤 1：在 Namecheap 中检查

1. 返回 Namecheap Advanced DNS 页面
2. 在 "Host Records" 部分查看所有记录
3. 确认所有记录都已正确添加

### 步骤 2：在 Resend Dashboard 中验证

1. 等待 5-30 分钟（DNS 传播时间）
2. 返回 Resend Dashboard → Domains → atockorea.com
3. 点击 **"Verify DNS Records"** 按钮
4. 查看每条记录的 Status：
   - ✅ **Verified** - 验证成功
   - ⏳ **Pending** - 等待验证
   - ❌ **Not Started** - 验证失败（检查记录）

---

## 🆘 常见问题

### Q: 在 Type 下拉菜单中找不到 "MX Record"？

**A:** 
1. **向下滚动查找**
   - Type 下拉菜单可能有很多选项
   - 向下滚动，查找 **"MX Record"** 或 **"MX"**

2. **检查 Mail Settings 部分**
   - 在 Advanced DNS 页面，查找 **"Mail Settings"** 或 **"Email Settings"** 部分
   - MX 记录可能在这个专门的部分

3. **查看所有可用类型**
   - 常见的类型包括：A Record, AAAA, ALIAS, CAA, CNAME, MX, NS, SRV, TXT, URL Redirect
   - 如果确实没有 MX，可能需要联系 Namecheap 支持

4. **临时解决方案**
   - 如果暂时无法添加 MX 记录，可以先添加 TXT 记录
   - TXT 记录对于发送邮件也是必需的
   - MX 记录主要用于接收邮件（可选）

### Q: 找不到 "Add New Record" 按钮？

**A:** 
- 确保你在 **"Advanced DNS"** 标签页
- 如果使用 Namecheap 的 BasicDNS，需要切换到 Advanced DNS
- 某些域名可能需要先启用 Advanced DNS

### Q: Host 字段应该填什么？

**A:**
- 从 Resend Dashboard 的 **"Name"** 列复制
- 只填写主机名部分，不要包含域名
- 例如：`resend._domainkey` 而不是 `resend._domainkey.atockorea.com`

### Q: Value 字段显示错误？

**A:**
- 确保完整复制 Resend Dashboard 中的 **"Content"** 值
- TXT 记录的 Content 可能很长，确保全部复制
- 检查是否有特殊字符遗漏

### Q: MX 记录的 Priority 填什么？

**A:**
- 从 Resend Dashboard 的 **"Priority"** 列复制
- Enable Sending MX: `10`
- Enable Receiving MX: `9`

### Q: 记录保存后多久生效？

**A:**
- 通常 5-30 分钟
- 最长可能需要 24 小时
- 使用 DNS 检查工具验证记录是否生效

---

## 🎉 完成！

所有记录添加完成后：

1. ✅ 等待 DNS 传播（5-30 分钟）
2. ✅ 返回 Resend Dashboard
3. ✅ 点击 **"Verify DNS Records"** 按钮
4. ✅ 确认所有记录状态为 **"Verified"**

然后你就可以使用 `support@atockorea.com` 发送邮件了！🎉

