# 后台系统访问说明

## 📍 访问地址

### 总台后台
```
http://localhost:3000/admin
```
**用途：** 管理所有商家、查看所有数据

### 商家后台
```
http://localhost:3000/merchant
```
**用途：** 商家管理自己的产品和订单

### 商家登录
```
http://localhost:3000/merchant/login
```
**用途：** 商家登录入口

---

## 🚀 快速创建 LoveKorea 商家账户

### 步骤1：运行创建脚本

在项目根目录运行：

```bash
npm run create-merchant
```

或者：

```bash
node scripts/create-merchant.js
```

### 步骤2：获取登录凭证

脚本运行成功后会显示：

```
✅ Merchant account created successfully!
📋 Login Credentials:
   Email: admin@lovekorea.com
   Password: [临时密码]
🌐 Login URL: http://localhost:3000/merchant/login
```

**请保存这些信息！**

### 步骤3：登录商家后台

1. 打开浏览器访问：`http://localhost:3000/merchant/login`

2. 输入凭证：
   - **邮箱：** `admin@lovekorea.com`
   - **密码：** 脚本显示的临时密码

3. **首次登录会强制修改密码**
   - 输入新密码（至少8个字符）
   - 确认新密码
   - 点击"修改密码并登录"

4. 登录成功后自动进入商家后台

---

## 📝 环境变量设置

在 `.env.local` 文件中设置：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**如何获取：**
1. 登录 Supabase Dashboard
2. Settings → API
3. 复制 `Project URL` 和 `service_role` key

---

## 🔐 创建管理员账户（首次使用）

如果还没有管理员账户，在 Supabase SQL Editor 中运行：

```sql
-- 1. 在 Supabase Dashboard 中手动创建用户（Authentication → Users）
-- 假设用户ID是 'your-admin-user-id'

-- 2. 设置管理员角色
INSERT INTO user_profiles (id, full_name, role)
VALUES ('your-admin-user-id', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

然后就可以访问总台后台了！

---

## ✅ 测试清单

创建商家后，测试以下功能：

- [ ] 商家可以登录
- [ ] 首次登录强制修改密码
- [ ] 商家可以访问 `/merchant` 后台
- [ ] 商家可以添加产品
- [ ] 商家只能看到自己的产品
- [ ] 总台可以看到所有商家

---

## 🆘 遇到问题？

### 问题1：脚本运行失败

**检查：**
- 环境变量是否设置正确
- Supabase 数据库是否已运行 merchant-schema.sql
- service_role key 是否正确

### 问题2：无法登录

**检查：**
- 邮箱和密码是否正确
- 商家账户状态是否为 `active`
- 浏览器控制台是否有错误

### 问题3：看不到数据

**正常！** 新创建的商家还没有产品，需要先添加产品。

---

## 📚 更多文档

- `docs/ACCESS_GUIDE.md` - 详细访问指南
- `docs/BACKEND_SYSTEM.md` - 系统架构
- `docs/API_DOCUMENTATION.md` - API文档

