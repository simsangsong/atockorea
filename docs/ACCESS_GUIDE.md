# 后台系统访问指南

## 访问路径

### 总台后台 (Admin Panel)

**URL：** `http://localhost:3000/admin`

**功能：**
- 管理所有商家
- 查看所有产品和订单
- 系统数据分析
- 创建新商家账户

**访问要求：**
- 需要管理员角色（`role = 'admin'`）

### 商家后台 (Merchant Dashboard)

**URL：** `http://localhost:3000/merchant`

**功能：**
- 管理自己的产品
- 查看自己的订单
- 客户管理
- 数据分析（仅限自己的数据）
- 商家设置

**访问要求：**
- 需要商家角色（`role = 'merchant'`）
- 首次登录需要修改密码

### 商家登录页面

**URL：** `http://localhost:3000/merchant/login`

商家使用邮箱和密码登录的地方。

## 创建 LoveKorea 商家账户

### 方法1：使用脚本（推荐）

1. **设置环境变量**

在项目根目录创建 `.env.local` 文件（如果还没有）：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. **运行创建脚本**

```bash
node scripts/create-merchant.js
```

脚本会自动：
- 创建用户账户
- 生成临时密码
- 创建商家记录
- 设置默认配置

3. **获取登录凭证**

脚本运行后会显示：
```
📋 Login Credentials:
   Email: admin@lovekorea.com
   Password: [生成的临时密码]
```

### 方法2：通过总台后台创建

1. **登录总台后台**
   - 访问：`http://localhost:3000/admin`
   - 使用管理员账户登录

2. **创建商家**
   - 进入"商家管理"
   - 点击"添加新商家"
   - 填写信息：
     - 公司名称：`LoveKorea Travel`
     - 联系邮箱：`admin@lovekorea.com`
     - 联系人：`LoveKorea Admin`
     - 联系电话：`010-0000-0000`
   - 点击"创建商家账户"

3. **获取凭证**
   - 创建成功后会显示登录凭证
   - 复制邮箱和临时密码

### 方法3：直接在 Supabase 创建

1. **在 Supabase Dashboard 中：**
   - Authentication → Users → Add User
   - Email: `admin@lovekorea.com`
   - Password: 设置一个临时密码
   - Auto Confirm User: ✅

2. **在 SQL Editor 中运行：**

```sql
-- 假设用户ID是 'user-uuid-here'
-- 1. 创建用户profile
INSERT INTO user_profiles (id, full_name, role)
VALUES ('user-uuid-here', 'LoveKorea Admin', 'merchant');

-- 2. 创建商家记录
INSERT INTO merchants (
  user_id,
  company_name,
  contact_person,
  contact_email,
  contact_phone,
  status,
  is_verified
) VALUES (
  'user-uuid-here',
  'LoveKorea Travel',
  'LoveKorea Admin',
  'admin@lovekorea.com',
  '010-0000-0000',
  'active',
  true
) RETURNING id;

-- 3. 创建默认设置（使用上面返回的merchant_id）
INSERT INTO merchant_settings (merchant_id)
VALUES ('merchant-uuid-from-above');
```

## LoveKorea 商家登录步骤

### 1. 访问登录页面

打开浏览器，访问：
```
http://localhost:3000/merchant/login
```

### 2. 输入登录凭证

- **邮箱：** `admin@lovekorea.com`
- **密码：** （使用创建时生成的临时密码）

### 3. 首次登录 - 修改密码

如果是首次登录，系统会强制要求修改密码：

1. 输入新密码（至少8个字符）
2. 确认新密码
3. 点击"修改密码并登录"

### 4. 进入商家后台

密码修改成功后，自动跳转到：
```
http://localhost:3000/merchant
```

现在可以开始管理产品了！

## 快速测试流程

### 完整测试流程

1. **创建商家账户**
   ```bash
   node scripts/create-merchant.js
   ```

2. **登录商家后台**
   - 访问：`http://localhost:3000/merchant/login`
   - 使用显示的凭证登录

3. **修改密码**
   - 首次登录强制修改
   - 设置新密码

4. **测试功能**
   - 进入"产品管理"
   - 添加一个测试产品
   - 查看"订单管理"
   - 查看"数据分析"

## 常见问题

### Q: 无法访问总台后台？

**A:** 检查：
1. 用户角色是否为 `admin`
2. 在 `user_profiles` 表中 `role = 'admin'`
3. 是否已登录

### Q: 商家登录后看不到数据？

**A:** 正常现象！新创建的商家还没有产品。可以：
1. 进入"产品管理"
2. 点击"添加新产品"
3. 创建第一个产品

### Q: 忘记密码怎么办？

**A:** 
- 总台管理员可以在 Supabase Dashboard 中重置
- 或实现"忘记密码"功能（待开发）

### Q: 如何查看所有商家？

**A:** 
- 总台管理员登录后
- 进入"商家管理"
- 可以看到所有商家列表

## 环境检查

确保以下环境变量已设置：

```bash
# 检查环境变量
echo $NEXT_PUBLIC_SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

如果未设置，在 `.env.local` 中添加：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 下一步

创建商家账户后，可以：
1. ✅ 登录商家后台
2. ✅ 添加产品
3. ✅ 管理订单
4. ✅ 查看数据分析

开始使用吧！🎉

