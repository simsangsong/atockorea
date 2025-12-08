# Namecheap 添加多个 MX 记录指南

## 📋 问题：只能添加一个 MX 记录？

Namecheap 的 Custom MX 界面一次只能添加一条 MX 记录，但 Resend 需要两条 MX 记录。以下是解决方案：

---

## 🎯 解决方案：分两次添加

### 方法 1：在 Custom MX 中多次添加（推荐）

Namecheap 允许在 Custom MX 模式下添加多条 MX 记录，但需要**分两次操作**：

#### 步骤 1：添加第一条 MX 记录（Enable Sending）

1. **选择 Custom MX**
   - 在 Mail Settings 下拉菜单中选择 **"Custom MX"**

2. **添加第一条记录**
   - **Host:** `send`
   - **Value:** `feedback-smtp.ap-northeast-1.amazonaws.com`（从 Resend Dashboard 复制）
   - **Priority:** `10`
   - **TTL:** Automatic

3. **保存**
   - 点击 **"SAVE ALL CHANGES"**

4. **确认记录已添加**
   - 在 MX 记录列表中应该能看到这条记录

#### 步骤 2：添加第二条 MX 记录（Enable Receiving）

1. **再次添加新记录**
   - 在 Custom MX 界面中，应该有 **"Add MX Record"** 或类似的按钮
   - 或再次点击 **"Add New Record"**

2. **添加第二条记录**
   - **Host:** `@`
   - **Value:** `inbound-smtp.ap-northeast-1.amazonaws.com`（从 Resend Dashboard 复制）
   - **Priority:** `9`
   - **TTL:** Automatic

3. **保存**
   - 点击 **"SAVE ALL CHANGES"**

4. **确认两条记录都存在**
   - 在 MX 记录列表中应该能看到两条记录：
     - `send` - Priority 10
     - `@` - Priority 9

---

### 方法 2：在 Host Records 部分添加（如果 Custom MX 不支持多条）

如果 Custom MX 界面确实只能添加一条，可以：

#### 步骤 1：在 Custom MX 中添加接收邮件的 MX（优先）

1. **选择 Custom MX**
2. **添加接收邮件的 MX 记录**
   - **Host:** `@`
   - **Value:** `inbound-smtp.ap-northeast-1.amazonaws.com`
   - **Priority:** `9`
   - 保存

#### 步骤 2：在 Host Records 部分添加发送邮件的 MX

1. **回到 Host Records 部分**
   - 在 Advanced DNS 页面找到 "Host Records" 部分

2. **添加新记录**
   - 点击 **"Add New Record"**
   - **Type:** 选择 `MX Record`（向下滚动查找）

3. **填写信息**
   - **Host:** `send`
   - **Value:** `feedback-smtp.ap-northeast-1.amazonaws.com`
   - **Priority:** `10`
   - **TTL:** Automatic

4. **保存**

---

## 📊 两条 MX 记录的区别

| 记录 | Host | Priority | 用途 | 重要性 |
|------|------|----------|------|--------|
| **Enable Sending MX** | `send` | `10` | 处理发送邮件的反馈（bounce、complaint） | ⚠️ 可选但推荐 |
| **Enable Receiving MX** | `@` | `9` | **接收发送到 support@atockorea.com 的邮件** | ✅ **必需（如果要接收）** |

---

## 🎯 优先级建议

### 如果只能添加一条，优先添加：

**Enable Receiving MX（接收邮件）** - Host: `@`, Priority: `9`

**原因：**
- ✅ 这是接收邮件的必需记录
- ✅ 没有这个记录，无法接收邮件
- ⚠️ Enable Sending MX 主要用于处理反馈，可以稍后添加

### 添加顺序：

1. **第一步：** 添加 Enable Receiving MX（`@`, Priority `9`）
2. **第二步：** 添加 Enable Sending MX（`send`, Priority `10`）

---

## 🔍 如何确认已添加多条记录

### 在 Namecheap 中查看：

1. **在 Custom MX 界面**
   - 应该能看到多条 MX 记录
   - 每条记录显示 Host、Value、Priority

2. **在 Host Records 部分**
   - 查找所有 Type 为 "MX Record" 的记录
   - 应该能看到：
     - `send` - Priority 10
     - `@` - Priority 9

---

## ⚠️ 重要提示

### 1. Host 值不同

- **Enable Sending MX:** Host = `send`（子域名）
- **Enable Receiving MX:** Host = `@`（根域名）

因为 Host 值不同，所以可以同时存在。

### 2. Priority 值

- **Enable Sending MX:** Priority = `10`
- **Enable Receiving MX:** Priority = `9`

数字越小，优先级越高。但这两个记录用于不同目的，所以优先级不会冲突。

### 3. 如果界面只显示一条

- 可能是界面限制
- 尝试刷新页面
- 或检查是否在 Host Records 部分也能看到

---

## ✅ 完成检查清单

添加完成后，确认：

- [ ] Enable Receiving MX 已添加（Host: `@`, Priority: `9`）
- [ ] Enable Sending MX 已添加（Host: `send`, Priority: `10`）
- [ ] 两条记录都在 Namecheap 中可见
- [ ] 已点击 "SAVE ALL CHANGES"
- [ ] 等待 5-30 分钟
- [ ] 在 Resend Dashboard 验证两条记录

---

## 🆘 如果还是只能添加一条

### 临时方案：

1. **先添加接收邮件的 MX**（`@`, Priority `9`）
   - 这是接收邮件的必需记录

2. **发送邮件的 MX 可以稍后添加**
   - Enable Sending MX 主要用于处理反馈
   - 可以先不添加，不影响基本发送功能
   - 稍后在 Host Records 部分添加

3. **联系 Namecheap 支持**
   - 询问如何添加多条 MX 记录
   - 或确认 Custom MX 是否支持多条记录

---

祝你设置顺利！🎉

