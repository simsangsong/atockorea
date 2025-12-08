# Resend 域名设置详细指南

## 📋 概述

在 Resend 中配置域名 `atockorea.com`，以便使用 `support@atockorea.com` 作为发送者邮箱。

---

## 🔧 步骤1：添加域名

### 1.1 登录 Resend Dashboard

1. **访问 Resend**
   - [https://resend.com](https://resend.com)
   - 登录你的账户

2. **进入 Domains 页面**
   - 左侧菜单 → **Domains**
   - 或直接访问：https://resend.com/domains

### 1.2 添加新域名

1. **点击 "Add Domain" 按钮**
   - 在 Domains 页面右上角
   - 或页面中间的 "Add Domain" 按钮

2. **输入域名**
   - 在输入框中输入：`atockorea.com`
   - **注意：** 不要包含 `www` 或 `http://`

3. **点击 "Add"**
   - 确认域名后点击 "Add" 按钮

---

## 🔧 步骤2：验证域名

### 2.1 查看 DNS 记录

添加域名后，Resend 会显示需要添加的 DNS 记录。

**通常需要添加以下类型的记录：**

1. **TXT 记录**（用于域名验证）
   - Name: `@` 或 `atockorea.com`
   - Value: Resend 提供的验证字符串
   - TTL: 3600（默认）

2. **CNAME 记录**（用于 SPF/DKIM）
   - Name: `_resend.` 或类似
   - Value: Resend 提供的 CNAME 值
   - TTL: 3600（默认）

3. **MX 记录**（如果需要）
   - 按照 Resend 的指示添加

### 2.2 在域名注册商处添加 DNS 记录

#### 📝 详细操作步骤（基于你的 DNS 管理界面）

**步骤 1：准备 Resend 提供的 DNS 记录**

在 Resend Dashboard → Domains → 你的域名页面，你会看到类似这样的记录：

```
类型: TXT
名称: @
值: resend-verification=xxxxxxxxxxxxx
TTL: 3600

类型: CNAME
名称: _resend
值: resend.net
TTL: 3600
```

**步骤 2：添加 TXT 记录（域名验证）**

1. **点击 "ADD NEW RECORD" 按钮**
   - 在 DNS Records 部分下方找到这个红色加号按钮

2. **选择记录类型**
   - 在 "Type" 下拉菜单中选择 **"TXT Record"**

3. **填写 Host 字段**
   - 在 "Host" 输入框中输入：`@`
   - 这表示根域名（atockorea.com）

4. **填写 Value 字段**
   - 在 "Value" 输入框中输入 Resend 提供的完整验证字符串
   - 例如：`resend-verification=abc123def456...`
   - ⚠️ **重要：** 必须完整复制，包括所有字符

5. **设置 TTL**
   - 在 "TTL" 下拉菜单中选择 **"Automatic"** 或 `3600`

6. **保存记录**
   - 点击该行右侧的 **绿色对勾 ✓** 保存
   - 或点击底部的 **"SAVE ALL CHANGES"** 按钮

**步骤 3：添加 CNAME 记录（SPF/DKIM）**

1. **再次点击 "ADD NEW RECORD"**

2. **选择记录类型**
   - 在 "Type" 下拉菜单中选择 **"CNAME Record"**

3. **填写 Host 字段**
   - 在 "Host" 输入框中输入：`_resend`
   - 或 Resend 提供的具体主机名（如 `_resend.atockorea.com`）

4. **填写 Value 字段**
   - 在 "Value" 输入框中输入 Resend 提供的 CNAME 值
   - 例如：`resend.net` 或 `xxx.resend.net`
   - ⚠️ **注意：** 如果值以点结尾（如 `resend.net.`），请保留这个点

5. **设置 TTL**
   - 选择 **"Automatic"** 或 `3600`

6. **保存记录**
   - 点击绿色对勾 ✓ 或 "SAVE ALL CHANGES"

**步骤 4：添加其他记录（如果需要）**

如果 Resend 还要求添加其他记录（如 MX 记录），重复上述步骤：
- 选择对应的记录类型
- 填写 Host 和 Value
- 保存

**步骤 5：验证记录已添加**

添加完成后，你的 DNS Records 列表应该显示：
- ✅ TXT Record - Host: @ - Value: resend-verification=...
- ✅ CNAME Record - Host: _resend - Value: resend.net

#### 🔍 常见问题解决

**问题 1：Value 字段显示红色警告**
- **原因：** 字段为空或格式不正确
- **解决：** 确保完整复制 Resend 提供的值，不要遗漏任何字符

**问题 2：记录保存后没有显示**
- **原因：** 可能需要刷新页面
- **解决：** 刷新浏览器页面，或等待几秒钟后查看

**问题 3：Host 字段应该填什么？**
- **对于根域名：** 填写 `@`
- **对于子域名：** 填写子域名部分（如 `mail` 表示 `mail.atockorea.com`）
- **对于特定记录：** 按照 Resend 提供的 Host 值填写

**问题 4：TTL 应该选什么？**
- **推荐：** 选择 "Automatic"（自动）
- **或手动设置：** `3600`（1小时）

#### 📋 如果使用其他域名注册商：

**GoDaddy:**
1. 登录 GoDaddy
2. 进入 "My Products" → 选择域名
3. 点击 "DNS" 或 "Manage DNS"
4. 点击 "Add" 添加新记录
5. 选择记录类型（TXT、CNAME 等）
6. 输入 Resend 提供的值
7. 点击 "Save"

**Namecheap:**
1. 登录 Namecheap
2. 进入 "Domain List"
3. 点击域名旁边的 "Manage"
4. 进入 "Advanced DNS" 标签
5. 点击 "Add New Record"
6. 选择记录类型并输入值
7. 点击保存图标

**Cloudflare:**
1. 登录 Cloudflare
2. 选择域名
3. 进入 "DNS" 页面
4. 点击 "Add record"
5. 选择记录类型并输入值
6. 点击 "Save"

### 2.3 等待验证

1. **DNS 传播时间**
   - 通常需要 **几分钟到几小时**
   - 最长可能需要 **24-48 小时**

2. **检查验证状态**
   - 返回 Resend Dashboard → Domains
   - 查看域名状态：
     - ✅ **Verified** - 验证成功
     - ⏳ **Pending** - 等待验证
     - ❌ **Failed** - 验证失败（检查 DNS 记录）

3. **验证失败处理**
   - 检查 DNS 记录是否正确添加
   - 确认记录值完全匹配（包括大小写）
   - 等待更长时间（DNS 传播可能需要时间）
   - 使用 DNS 检查工具验证记录是否生效

---

## 🔧 步骤3：设置发送者邮箱

### 3.1 验证域名后

域名验证成功后（状态显示为 **Verified**），你可以使用该域名下的任何邮箱地址作为发送者。

### 3.2 使用 support@atockorea.com

1. **在代码中使用**
   ```typescript
   from: 'AtoCKorea <support@atockorea.com>'
   // 或
   from: 'support@atockorea.com'
   ```

2. **验证发送者**
   - Resend 会自动验证域名下的邮箱地址
   - 无需额外配置

---

## 📝 DNS 记录示例和填写指南

### 典型的 DNS 记录配置：

#### 示例 1：域名验证 TXT 记录

**在你的 DNS 管理界面中：**
```
Type: TXT Record
Host: @
Value: resend-verification=abc123def456ghi789jkl012mno345pqr678stu901vwx234yz
TTL: Automatic (或 3600)
```

**操作步骤：**
1. 点击 "ADD NEW RECORD"
2. Type 选择 "TXT Record"
3. Host 输入 `@`
4. Value 输入完整的验证字符串（从 Resend 复制）
5. TTL 选择 "Automatic"
6. 点击绿色对勾 ✓ 保存

#### 示例 2：SPF/DKIM CNAME 记录

**在你的 DNS 管理界面中：**
```
Type: CNAME Record
Host: _resend
Value: resend.net
TTL: Automatic (或 3600)
```

**操作步骤：**
1. 点击 "ADD NEW RECORD"
2. Type 选择 "CNAME Record"
3. Host 输入 `_resend`
4. Value 输入 `resend.net`（或 Resend 提供的具体值）
5. TTL 选择 "Automatic"
6. 点击绿色对勾 ✓ 保存

#### 示例 3：SPF TXT 记录（如果需要）

**在你的 DNS 管理界面中：**
```
Type: TXT Record
Host: @
Value: v=spf1 include:_spf.resend.com ~all
TTL: Automatic (或 3600)
```

**注意：** 
- 实际值由 Resend 提供，请使用 Resend Dashboard 中显示的确切值
- 如果已有 SPF 记录，可能需要合并，而不是替换

### 📸 界面字段对应关系

| Resend 术语 | DNS 管理界面字段 | 说明 |
|------------|----------------|------|
| Type | Type / 类型 | 选择 TXT、CNAME 等 |
| Name / Host | Host | 填写 `@` 或子域名 |
| Value | Value | 完整的记录值 |
| TTL | TTL | 选择 "Automatic" 或输入秒数 |

### ⚠️ 重要注意事项

1. **Value 字段必须完整**
   - 不要遗漏任何字符
   - 包括所有特殊字符和等号
   - 如果值很长，确保全部复制

2. **Host 字段规则**
   - `@` 表示根域名（atockorea.com）
   - 子域名直接填写名称（如 `mail` 表示 `mail.atockorea.com`）
   - 不要包含完整的域名

3. **保存方式**
   - 可以逐条保存（点击每行的绿色对勾）
   - 或全部添加后点击 "SAVE ALL CHANGES"

4. **记录顺序**
   - DNS 记录顺序不重要
   - 只要所有必需的记录都存在即可

---

## ✅ 验证检查清单

- [ ] 域名已添加到 Resend
- [ ] DNS 记录已添加到域名注册商
- [ ] 等待 DNS 传播（几分钟到几小时）
- [ ] 在 Resend Dashboard 中检查验证状态
- [ ] 域名状态显示为 "Verified"
- [ ] 可以使用 `support@atockorea.com` 发送邮件

---

## 🆘 常见问题

### Q: DNS 记录添加后多久生效？

**A:**
- 通常 **5-30 分钟**
- 最长可能需要 **24-48 小时**
- 使用 DNS 检查工具（如 [dnschecker.org](https://dnschecker.org)）查看传播状态

### Q: 如何检查 DNS 记录是否正确？

**A:**
1. 使用在线 DNS 检查工具：
   - [dnschecker.org](https://dnschecker.org)
   - [mxtoolbox.com](https://mxtoolbox.com)
2. 输入域名和记录类型
3. 查看是否返回正确的值

### Q: 验证一直失败怎么办？

**A:**
1. **检查 DNS 记录**
   - 确认记录类型正确（TXT、CNAME 等）
   - 确认记录值完全匹配（包括所有字符）
   - 确认 TTL 设置合理（3600 或默认值）

2. **等待更长时间**
   - DNS 传播可能需要时间
   - 某些地区可能需要更长时间

3. **联系 Resend 支持**
   - 如果 24 小时后仍未验证
   - 提供 DNS 记录的截图

### Q: 可以使用子域名吗？

**A:**
- 可以，例如 `mail.atockorea.com`
- 添加子域名时，DNS 记录的名称需要相应调整
- 例如：`mail` 而不是 `@`

### Q: 一个域名可以添加多个发送者吗？

**A:**
- 可以，域名验证后，可以使用该域名下的任何邮箱地址
- 例如：
  - `support@atockorea.com`
  - `noreply@atockorea.com`
  - `info@atockorea.com`

---

## 🎯 快速参考

### Resend Dashboard 导航

```
登录 Resend
  ↓
左侧菜单 → Domains
  ↓
点击 "Add Domain"
  ↓
输入: atockorea.com
  ↓
点击 "Add"
  ↓
查看 DNS 记录要求
  ↓
在域名注册商添加 DNS 记录
  ↓
等待验证完成
  ↓
使用 support@atockorea.com 发送邮件
```

---

## 🎉 完成！

域名验证完成后，你就可以：
1. ✅ 使用 `support@atockorea.com` 作为发送者
2. ✅ 发送验证码邮件
3. ✅ 邮件会显示来自 AtoCKorea

祝你使用愉快！🎉

