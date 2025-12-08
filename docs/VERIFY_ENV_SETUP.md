# 验证环境变量配置

## ✅ 配置检查清单

### 1. `.env.local` 文件位置
- [ ] 文件在项目根目录：`C:\Users\sangsong\atockorea\.env.local`
- [ ] 文件名正确：`.env.local`（不是 `.env.local.txt`）

### 2. 环境变量内容

`.env.local` 应该包含：

```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=https://cghyvbwmijqpahnoduyv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon_public_key
SUPABASE_SERVICE_ROLE_KEY=你的service_role_key

# 应用URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. 验证步骤

#### 步骤1：检查服务器是否启动

等待10-20秒，然后访问：
- `http://localhost:3000` - 应该正常显示

#### 步骤2：检查环境变量是否加载

在浏览器控制台（F12）中，运行：

```javascript
// 检查环境变量（注意：只有 NEXT_PUBLIC_ 开头的变量可以在客户端访问）
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

#### 步骤3：测试 Supabase 连接

访问页面后，检查浏览器控制台是否有 Supabase 相关错误。

---

## 🔍 常见问题

### Q: 环境变量不生效？

**A:** 检查：
1. 文件名：`.env.local`（不是 `.env.local.txt`）
2. 文件位置：项目根目录
3. 已重启服务器
4. 变量名正确（注意大小写）

### Q: 如何验证 service_role key？

**A:** service_role key 只在服务器端使用，可以通过：
1. 访问 API 路由测试
2. 运行 `npm run create-merchant` 脚本
3. 检查 API 是否正常工作

### Q: 服务器启动失败？

**A:** 检查：
1. 终端是否有错误信息
2. 端口3000是否被占用
3. 依赖是否已安装（`npm install`）

---

## ✅ 成功标志

配置成功后：
- ✅ 服务器正常启动（显示 "Ready"）
- ✅ 可以访问 `http://localhost:3000`
- ✅ 可以访问 `http://localhost:3000/admin`
- ✅ 没有 Supabase 连接错误

---

## 🎯 下一步

配置完成后：
1. ✅ 执行 SQL 脚本创建数据库表
2. ✅ 创建管理员账户
3. ✅ 测试系统功能

