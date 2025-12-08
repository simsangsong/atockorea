# Resend DNS 记录类型识别指南

## 📋 如何识别 TXT 和 CNAME 记录

### 🔍 在 Resend Dashboard 中识别记录类型

在 Resend Dashboard → Domains → 你的域名页面，你会看到需要添加的 DNS 记录。以下是如何识别每种类型：

---

## 📝 TXT 记录（文本记录）

### 特征：
- **Type 列显示：** `TXT` 或 `TXT Record`
- **用途：** 域名验证、SPF、DKIM、DMARC
- **Value 通常以：** 
  - `resend-verification=` 开头（域名验证）
  - `v=spf1` 开头（SPF 记录）
  - `p=` 开头（DKIM 记录）
  - `v=DMARC1` 开头（DMARC 记录）

### 示例：

#### 1. 域名验证 TXT 记录
```
Type: TXT
Name/Host: @
Value: resend-verification=abc123def456...
TTL: 3600
```

#### 2. SPF TXT 记录
```
Type: TXT
Name/Host: @
Value: v=spf1 include:_spf.resend.com ~all
TTL: 3600
```

#### 3. DKIM TXT 记录
```
Type: TXT
Name/Host: resend._domainkey
Value: p=MIGfMA0GCSqGSIb3DQEB...（很长的字符串）
TTL: 3600
```

---

## 🔗 CNAME 记录（别名记录）

### 特征：
- **Type 列显示：** `CNAME` 或 `CNAME Record`
- **用途：** 域名别名、SPF/DKIM 配置
- **Value 通常是：** 
  - 另一个域名（如 `resend.net`）
  - 以点结尾（如 `resend.net.`）

### 示例：

#### 1. SPF/DKIM CNAME 记录
```
Type: CNAME
Name/Host: _resend
Value: resend.net
TTL: 3600
```

---

## 📊 记录类型对比表

| 特征 | TXT 记录 | CNAME 记录 |
|------|---------|-----------|
| **Type 显示** | `TXT` | `CNAME` |
| **Value 格式** | 文本字符串 | 域名 |
| **常见用途** | 验证、SPF、DKIM | 别名、配置 |
| **Value 示例** | `resend-verification=...` | `resend.net` |
| **是否以点结尾** | 通常不 | 可能以 `.` 结尾 |

---

## 🎯 Resend 通常需要的记录

### 基础验证（必需）

1. **TXT 记录 - 域名验证**
   ```
   Type: TXT
   Name: @
   Value: resend-verification=xxxxxxxxxxxxx
   ```

2. **CNAME 记录 - SPF/DKIM**
   ```
   Type: CNAME
   Name: _resend
   Value: resend.net
   ```

### 完整配置（推荐）

如果 Resend 还要求添加其他记录：

3. **TXT 记录 - SPF**
   ```
   Type: TXT
   Name: @
   Value: v=spf1 include:_spf.resend.com ~all
   ```

4. **TXT 记录 - DKIM**
   ```
   Type: TXT
   Name: resend._domainkey
   Value: p=MIGfMA0GCSqGSIb3DQEB...（长字符串）
   ```

---

## 🔍 在你的 DNS 管理界面中如何填写

### 对于 TXT 记录：

1. **Type 下拉菜单：** 选择 `TXT Record` 或 `TXT`
2. **Host 字段：** 填写 `@` 或 Resend 提供的 Name（如 `resend._domainkey`）
3. **Value 字段：** 完整复制 Resend 提供的 Content/Value
4. **TTL：** 选择 `Automatic` 或 `3600`

### 对于 CNAME 记录：

1. **Type 下拉菜单：** 选择 `CNAME Record` 或 `CNAME`
2. **Host 字段：** 填写 Resend 提供的 Name（如 `_resend`）
3. **Value 字段：** 填写 Resend 提供的域名（如 `resend.net`）
4. **TTL：** 选择 `Automatic` 或 `3600`

---

## ⚠️ 重要提示

### TXT 记录注意事项：

1. **Value 必须完整**
   - TXT 记录的 Value 可能很长
   - 必须完整复制，不要遗漏任何字符
   - 包括所有特殊字符和等号

2. **多个 TXT 记录可以共存**
   - 同一个 Host（如 `@`）可以有多个 TXT 记录
   - 例如：域名验证 TXT 和 SPF TXT 可以同时存在

### CNAME 记录注意事项：

1. **不能与其他记录类型冲突**
   - CNAME 记录不能与同名的其他记录类型共存
   - 例如：如果已有 `_resend` 的 A 记录，需要先删除

2. **Value 可能以点结尾**
   - 某些 DNS 系统要求 CNAME 值以点结尾（如 `resend.net.`）
   - 按照 Resend 提供的值填写，保留点

---

## 📸 在 Resend Dashboard 中查看

### 步骤：

1. **登录 Resend Dashboard**
   - 访问 https://resend.com
   - 登录你的账户

2. **进入 Domains 页面**
   - 左侧菜单 → **Domains**
   - 点击你的域名 `atockorea.com`

3. **查看 DNS 记录要求**
   - 页面会显示需要添加的所有记录
   - 每行记录都有：
     - **Type** 列：显示 `TXT` 或 `CNAME`
     - **Name** 列：显示 Host 值
     - **Value/Content** 列：显示需要添加的值

4. **识别记录类型**
   - 查看 **Type** 列即可知道是 TXT 还是 CNAME
   - TXT 记录的 Value 通常是文本字符串
   - CNAME 记录的 Value 通常是域名

---

## ✅ 快速检查清单

添加记录前，确认：

- [ ] 已识别所有 TXT 记录（Type = TXT）
- [ ] 已识别所有 CNAME 记录（Type = CNAME）
- [ ] 已复制完整的 Value/Content 值
- [ ] 已确认 Host/Name 值正确
- [ ] 已准备好添加到 DNS 管理界面

---

## 🎯 总结

**TXT 记录：**
- Type 显示为 `TXT`
- Value 是文本字符串
- 用于验证、SPF、DKIM

**CNAME 记录：**
- Type 显示为 `CNAME`
- Value 是域名
- 用于别名、配置

在 Resend Dashboard 中，**Type 列**会明确显示每条记录的类型，直接查看即可！

