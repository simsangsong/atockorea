# Vercel 部署问题排查指南

## 问题：atockorea.com 看不到内容

### 可能的原因：

1. **代码未同步到 GitHub**
2. **Vercel 构建失败**
3. **环境变量未配置**
4. **域名配置问题**

---

## 解决步骤

### 第一步：提交所有更改到 GitHub

```bash
# 1. 添加所有更改
git add .

# 2. 提交更改
git commit -m "Update package.json for mobile access and fix page.tsx"

# 3. 推送到 GitHub
git push origin main
```

### 第二步：检查 Vercel 项目设置

1. **登录 Vercel Dashboard**
   - 访问 [https://vercel.com](https://vercel.com)
   - 登录你的账号

2. **检查项目连接**
   - 进入你的项目（atockorea）
   - 检查是否连接到正确的 GitHub 仓库
   - 确认分支是 `main`

3. **检查部署状态**
   - 进入 **Deployments** 标签
   - 查看最新的部署状态
   - 如果显示 "Failed"，点击查看错误日志

### 第三步：检查构建日志

在 Vercel Dashboard 中：
1. 点击最新的部署
2. 查看 **Build Logs**
3. 查找错误信息

**常见错误：**
- ❌ `Module not found` - 缺少依赖
- ❌ `Syntax error` - 代码语法错误
- ❌ `Environment variable missing` - 缺少环境变量
- ❌ `Build failed` - 构建失败

### 第四步：检查环境变量

在 Vercel Dashboard 中：
1. 进入项目 **Settings** > **Environment Variables**
2. 检查是否需要添加以下变量：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (如果需要)

### 第五步：重新部署

1. **手动触发部署**
   - 在 Vercel Dashboard 中
   - 点击 **Deployments** > **Redeploy**

2. **或者推送新提交**
   ```bash
   git commit --allow-empty -m "Trigger Vercel deployment"
   git push origin main
   ```

### 第六步：检查域名配置

1. **检查域名设置**
   - 进入 **Settings** > **Domains**
   - 确认 `atockorea.com` 已正确配置
   - 检查 DNS 记录是否正确

2. **检查 SSL 证书**
   - 确认 SSL 证书已激活
   - 如果未激活，等待几分钟让 Vercel 自动配置

---

## 快速诊断命令

### 本地测试构建

```bash
# 清除缓存
rm -rf .next

# 安装依赖
npm install

# 测试构建
npm run build

# 如果构建成功，测试生产环境
npm run start
```

### 检查代码同步

```bash
# 检查本地和远程的差异
git fetch origin
git log HEAD..origin/main

# 如果本地落后，拉取最新代码
git pull origin main
```

---

## 常见问题解决

### 问题 1: 构建失败 - "Module not found"

**解决：**
```bash
# 确保 package.json 包含所有依赖
npm install

# 提交 package.json 和 package-lock.json
git add package.json package-lock.json
git commit -m "Update dependencies"
git push origin main
```

### 问题 2: 页面空白

**可能原因：**
- 客户端组件错误
- 环境变量未设置
- API 调用失败

**解决：**
1. 检查浏览器控制台错误
2. 检查 Vercel 函数日志
3. 确认环境变量已配置

### 问题 3: 样式不显示

**可能原因：**
- Tailwind CSS 未正确构建
- CSS 文件未加载

**解决：**
1. 检查 `tailwind.config.js` 配置
2. 确认 `globals.css` 已正确导入
3. 检查构建日志中的 CSS 相关错误

---

## 验证部署

### 检查部署 URL

Vercel 会为每个部署生成一个 URL：
- 格式：`https://atockorea-xxxxx.vercel.app`
- 检查这个 URL 是否正常显示

### 检查生产构建

1. 在 Vercel Dashboard 中查看部署
2. 点击部署 URL
3. 检查页面是否正常显示

---

## 需要帮助？

如果以上步骤都无法解决问题：

1. **查看 Vercel 文档**
   - [Vercel Deployment Guide](https://vercel.com/docs/deployments/overview)
   - [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)

2. **检查 Vercel 状态**
   - [Vercel Status Page](https://www.vercel-status.com/)

3. **联系 Vercel 支持**
   - 在 Vercel Dashboard 中提交支持请求

