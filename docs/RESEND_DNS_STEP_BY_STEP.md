# Resend DNS 设置 - 逐步操作指南

## 🎯 目标

在你的域名注册商的 DNS 管理界面中添加 Resend 提供的 DNS 记录，以验证域名 `atockorea.com`。

**注意：** 如果你使用的是 **Namecheap**，请查看更详细的指南：
👉 [`docs/RESEND_NAMECHEAP_SETUP.md`](./RESEND_NAMECHEAP_SETUP.md)

---

## 📋 准备工作

### 步骤 1：获取 Resend DNS 记录

1. 登录 [Resend Dashboard](https://resend.com)
2. 进入 **Domains** 页面
3. 找到 `atockorea.com` 域名
4. 点击域名进入详情页
5. **查看需要添加的 DNS 记录**

#### 🔍 如何识别记录类型：

在 Resend Dashboard 的 DNS 记录列表中：

- **TXT 记录：** Type 列显示 `TXT`
  - Value 通常是文本字符串
  - 例如：`resend-verification=abc123...` 或 `v=spf1 include:...`

- **CNAME 记录：** Type 列显示 `CNAME`
  - Value 通常是域名
  - 例如：`resend.net` 或 `xxx.resend.net`

**详细识别指南：** 查看 `docs/RESEND_DNS_RECORD_TYPES.md`

#### 📋 示例记录（实际值由 Resend 提供）：

**TXT 记录示例：**
```
Type: TXT
Name/Host: @
Value/Content: resend-verification=abc123def456...
TTL: 3600
```

**CNAME 记录示例：**
```
Type: CNAME
Name/Host: _resend
Value/Content: resend.net
TTL: 3600
```

**注意：** 在 Resend Dashboard 中，每条记录都会明确显示 **Type** 列，直接查看即可知道是 TXT 还是 CNAME！

---

## 🔧 详细操作步骤

### 步骤 2：登录域名注册商

1. 登录你的域名注册商账户
2. 进入域名管理页面
3. 找到 **DNS Management** 或 **DNS Settings** 选项
4. 点击进入 DNS 管理界面

---

### 步骤 3：添加 TXT 记录（域名验证）

#### 3.1 开始添加记录

1. 在 DNS Records 部分，找到 **"ADD NEW RECORD"** 按钮
2. 点击该按钮

#### 3.2 填写记录信息

**在出现的输入行中：**

1. **Type（类型）**
   - 点击下拉菜单
   - 选择 **"TXT Record"**

2. **Host（主机名）**
   - 在输入框中输入：`@`
   - 这表示根域名（atockorea.com）
   - ⚠️ **注意：** 只输入 `@`，不要输入 `@.atockorea.com`

3. **Value（值）**
   - 在输入框中粘贴 Resend 提供的完整验证字符串
   - 例如：`resend-verification=abc123def456ghi789...`
   - ⚠️ **重要：**
     - 必须完整复制，包括所有字符
     - 不要添加或删除任何字符
     - 如果值很长，确保全部复制

4. **TTL（生存时间）**
   - 点击下拉菜单
   - 选择 **"Automatic"**（推荐）
   - 或手动输入 `3600`

#### 3.3 保存记录

**有两种保存方式：**

**方式 A：单条保存**
- 点击该行右侧的 **绿色对勾 ✓** 图标
- 记录会立即保存

**方式 B：批量保存**
- 继续添加其他记录
- 所有记录添加完成后
- 点击底部的 **"SAVE ALL CHANGES"** 按钮

---

### 步骤 4：添加 CNAME 记录（SPF/DKIM）

#### 4.1 添加新记录

1. 再次点击 **"ADD NEW RECORD"** 按钮

#### 4.2 填写记录信息

1. **Type（类型）**
   - 选择 **"CNAME Record"**

2. **Host（主机名）**
   - 输入：`_resend`
   - 或按照 Resend 提供的具体 Host 值填写
   - ⚠️ **注意：** 只输入主机名部分，不要包含域名

3. **Value（值）**
   - 输入 Resend 提供的 CNAME 值
   - 例如：`resend.net` 或 `xxx.resend.net`
   - ⚠️ **注意：**
     - 如果值以点结尾（如 `resend.net.`），请保留这个点
     - 确保值与 Resend 提供的完全一致

4. **TTL（生存时间）**
   - 选择 **"Automatic"** 或 `3600`

#### 4.3 保存记录

- 点击绿色对勾 ✓ 或使用 "SAVE ALL CHANGES"

---

### 步骤 5：验证记录已添加

#### 5.1 检查记录列表

添加完成后，你的 DNS Records 列表应该显示：

```
✅ TXT Record
   Host: @
   Value: resend-verification=...
   TTL: Automatic

✅ CNAME Record
   Host: _resend
   Value: resend.net
   TTL: Automatic
```

#### 5.2 确认记录正确

- ✅ 记录类型正确（TXT、CNAME）
- ✅ Host 值正确（`@` 或 `_resend`）
- ✅ Value 值完整且正确
- ✅ TTL 已设置

---

## ⏱️ 等待 DNS 传播

### 步骤 6：等待验证

1. **DNS 传播时间**
   - 通常需要 **5-30 分钟**
   - 最长可能需要 **24 小时**

2. **检查验证状态**
   - 返回 Resend Dashboard → Domains
   - 查看域名状态：
     - ⏳ **Pending** - 等待验证中
     - ✅ **Verified** - 验证成功
     - ❌ **Failed** - 验证失败

3. **验证失败处理**
   - 检查 DNS 记录是否正确添加
   - 确认记录值完全匹配
   - 等待更长时间（DNS 传播需要时间）
   - 使用 DNS 检查工具验证记录是否生效

---

## 🔍 常见问题和解决方案

### 问题 1：Value 字段显示红色警告

**症状：**
- Value 输入框有红色虚线边框
- 旁边显示红色警告图标

**原因：**
- 字段为空
- 格式不正确
- 必填字段未填写

**解决方案：**
1. 确保 Value 字段不为空
2. 完整复制 Resend 提供的值
3. 检查是否有特殊字符遗漏

---

### 问题 2：记录保存后没有显示

**症状：**
- 点击保存后，记录没有出现在列表中

**解决方案：**
1. **刷新页面**
   - 按 `F5` 或点击浏览器刷新按钮
   - 等待几秒钟后查看

2. **检查保存按钮**
   - 确保点击了绿色对勾 ✓
   - 或点击了 "SAVE ALL CHANGES"

3. **查看错误提示**
   - 检查页面是否有错误消息
   - 确认记录格式是否正确

---

### 问题 3：Host 字段应该填什么？

**常见情况：**

| Resend 要求 | DNS 界面 Host 字段 | 说明 |
|------------|-------------------|------|
| `@` | `@` | 根域名（atockorea.com） |
| `_resend` | `_resend` | 子域名（_resend.atockorea.com） |
| `mail` | `mail` | 子域名（mail.atockorea.com） |

**规则：**
- ✅ 只填写主机名部分
- ❌ 不要包含完整域名
- ❌ 不要包含 `.atockorea.com`

---

### 问题 4：TTL 应该选什么？

**推荐设置：**
- **"Automatic"**（自动）- 最佳选择
- 或手动输入 `3600`（1小时）

**不推荐：**
- 过短的 TTL（如 60 秒）- 可能导致性能问题
- 过长的 TTL（如 86400 秒）- 更新记录时等待时间长

---

### 问题 5：记录值太长，无法完整输入

**解决方案：**
1. **使用复制粘贴**
   - 从 Resend Dashboard 完整复制值
   - 直接粘贴到 Value 字段
   - 不要手动输入

2. **检查输入框限制**
   - 某些界面可能有字符限制
   - 如果遇到限制，联系域名注册商支持

3. **分段输入（不推荐）**
   - 某些 DNS 系统支持长 TXT 记录分段
   - 但 Resend 的验证字符串应该一次性输入

---

### 问题 6：已有同名记录冲突

**症状：**
- 尝试添加记录时提示已存在同名记录

**解决方案：**

**对于 TXT 记录：**
- 可以存在多个 TXT 记录
- 检查是否真的冲突，或可以共存

**对于 CNAME 记录：**
- CNAME 记录不能与其他记录类型共存
- 如果已有同名记录，需要：
  1. 删除旧记录
  2. 或使用不同的 Host 值

---

## ✅ 完成检查清单

完成所有步骤后，确认：

- [ ] 已从 Resend Dashboard 获取所有 DNS 记录
- [ ] 已添加 TXT 记录（域名验证）
- [ ] 已添加 CNAME 记录（SPF/DKIM）
- [ ] 所有记录的 Host 值正确
- [ ] 所有记录的 Value 值完整且正确
- [ ] 所有记录已保存
- [ ] 记录在 DNS 列表中可见
- [ ] 已等待至少 5 分钟
- [ ] 在 Resend Dashboard 检查验证状态
- [ ] 域名状态显示为 "Verified"

---

## 🎉 验证成功

当 Resend Dashboard 显示域名状态为 **"Verified"** 时，你就可以：

1. ✅ 使用 `support@atockorea.com` 作为发送者
2. ✅ 发送验证码邮件
3. ✅ 邮件会显示来自 AtoCKorea

---

## 📞 需要帮助？

如果遇到问题：

1. **检查 DNS 记录**
   - 使用 [dnschecker.org](https://dnschecker.org) 验证记录是否生效
   - 输入域名和记录类型，查看全球 DNS 传播状态

2. **联系支持**
   - Resend 支持：support@resend.com
   - 域名注册商支持：查看注册商帮助文档

3. **查看文档**
   - Resend 官方文档：https://resend.com/docs
   - 域名注册商 DNS 管理指南

---

祝你设置顺利！🎉

