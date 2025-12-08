# Resend Webhook URL 配置指南

## ⚠️ 重要：必须使用生产环境 URL

### 问题：如果填写本地开发地址会怎样？

**如果填写 `http://localhost:3000/api/webhooks/resend`：**

❌ **主机关机时无法接收邮件**
- `localhost` 只能在本机访问
- Resend 服务器无法从外部访问你的本地主机
- 当你的电脑关机或本地服务器未运行时，webhook 无法工作

❌ **无法从外部访问**
- Resend 的服务器在互联网上，无法访问你本地的 `localhost`
- Webhook 请求会失败

---

## ✅ 正确的配置

### 生产环境（必须使用）

**URL:** `https://atockorea.com/api/webhooks/resend`

**优点：**
- ✅ 24/7 可访问（只要服务器运行）
- ✅ Resend 可以从外部访问
- ✅ 即使你的电脑关机，服务器仍然可以接收邮件

**要求：**
- 网站必须已部署到生产环境（如 Vercel）
- 域名必须正确配置
- SSL 证书必须有效（HTTPS）

---

## 🔧 本地开发测试

### 如果需要本地测试 webhook：

#### 方法 1：使用 ngrok（推荐）

1. **安装 ngrok**
   ```bash
   npm install -g ngrok
   # 或访问 https://ngrok.com 下载
   ```

2. **启动本地服务器**
   ```bash
   npm run dev
   ```

3. **创建 ngrok 隧道**
   ```bash
   ngrok http 3000
   ```

4. **获取公网 URL**
   - ngrok 会提供一个公网 URL，例如：`https://abc123.ngrok.io`
   - 使用这个 URL 配置 webhook：`https://abc123.ngrok.io/api/webhooks/resend`

5. **在 Resend 中配置**
   - URL: `https://abc123.ngrok.io/api/webhooks/resend`
   - ⚠️ **注意：** ngrok 免费版每次重启 URL 会变化，需要重新配置

#### 方法 2：直接使用生产环境测试

- 直接在生产环境测试
- 在 `/admin/emails` 页面查看收到的邮件

---

## 📋 Webhook URL 配置对比

| URL 类型 | 地址 | 可访问性 | 主机关机时 | 用途 |
|---------|------|---------|-----------|------|
| **本地开发** | `http://localhost:3000/...` | ❌ 仅本机 | ❌ 无法接收 | 仅本地测试 |
| **ngrok 隧道** | `https://abc123.ngrok.io/...` | ✅ 公网可访问 | ⚠️ 需要本地服务器运行 | 本地开发测试 |
| **生产环境** | `https://atockorea.com/...` | ✅ 公网可访问 | ✅ 可以接收（服务器运行） | **生产使用** |

---

## 🎯 推荐配置

### 生产环境 Webhook（必须）

```
Name: AtoCKorea Email Receiver
URL: https://atockorea.com/api/webhooks/resend
Events: email.received
```

### 本地开发测试（可选）

如果需要本地测试，使用 ngrok：
```
Name: AtoCKorea Email Receiver (Local Test)
URL: https://abc123.ngrok.io/api/webhooks/resend
Events: email.received
```

**⚠️ 注意：** 本地测试完成后，记得切换回生产环境 URL！

---

## ✅ 完成检查清单

- [ ] 已使用生产环境 URL 配置 webhook（`https://atockorea.com/api/webhooks/resend`）
- [ ] 网站已部署到生产环境
- [ ] 域名和 SSL 证书配置正确
- [ ] 测试发送邮件到 `support@atockorea.com`
- [ ] 在 Resend Dashboard 查看 webhook 日志
- [ ] 在 `/admin/emails` 查看收到的邮件

---

## 🆘 常见问题

### Q: 为什么不能使用 localhost？

**A:**
- `localhost` 只能在本机访问
- Resend 的服务器在互联网上，无法访问你的本地主机
- 必须使用公网可访问的 URL

### Q: 主机关机时还能接收邮件吗？

**A:**
- 如果使用 `localhost`：❌ 不能
- 如果使用生产环境 URL：✅ 可以（只要服务器运行）

### Q: 如何测试 webhook？

**A:**
- **方法 1：** 直接在生产环境测试
- **方法 2：** 使用 ngrok 创建公网隧道
- **方法 3：** 在 Resend Dashboard 查看 webhook 日志

---

## 🎯 总结

**必须使用生产环境 URL：**
- ✅ `https://atockorea.com/api/webhooks/resend`

**不要使用本地开发地址：**
- ❌ `http://localhost:3000/api/webhooks/resend`

这样即使你的电脑关机，服务器仍然可以接收邮件！🎉

