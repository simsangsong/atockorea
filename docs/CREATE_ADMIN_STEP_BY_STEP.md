# 创建第一个管理员 - 详细步骤

## 📋 完整流程

### 步骤1：在 Supabase Dashboard 中创建用户

#### 1.1 打开 Authentication 页面

1. **登录 Supabase Dashboard**
   - 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - **重要：** 如果看到组织级别菜单（Projects, Team, Billing），需要先：
     - 点击左侧菜单的 **Projects**
     - 选择你的项目（如：`atockorea`）
     - 进入项目内部

2. **进入 Authentication**
   - 确保你在项目内部（左侧菜单应该显示：Table Editor, SQL Editor, Database等）
   - 在左侧菜单中，找到 **Authentication**（锁图标 🔒）
   - 通常在 **Database** 和 **Storage** 之间
   - 点击 **Authentication**
   
   **如果找不到：**
   - 检查是否在项目内部（不是组织级别）
   - 尝试向下滚动左侧菜单
   - 或使用搜索功能查找 "Authentication"

#### 1.2 创建新用户

1. **打开用户管理页面**
   - 在 Authentication 页面，点击顶部标签 **Users**（用户）
   - 你会看到用户列表（可能是空的）

2. **添加新用户**
   - 点击页面右上角的 **Add user**（添加用户）按钮
   - 或点击 **Create new user**（创建新用户）

3. **填写用户信息**
   
   **方式A：手动创建（推荐）**
   - **Email**: `admin@atockorea.com`（或你喜欢的邮箱）
   - **Password**: 设置一个强密码（至少8个字符，包含大小写字母、数字）
   - **Auto Confirm User**: ✅ **勾选这个选项**（重要！）
   - 点击 **Create user**（创建用户）

   **方式B：通过邀请链接**
   - 点击 **Invite user**（邀请用户）
   - 输入邮箱地址
   - 系统会发送邀请邮件

#### 1.3 复制用户ID

1. **找到新创建的用户**
   - 用户创建成功后，会在用户列表中显示
   - 找到刚才创建的用户（邮箱：`admin@atockorea.com`）

2. **复制用户ID**
   - 点击用户行，或点击用户邮箱
   - 在用户详情页面，找到 **User UID** 或 **ID**
   - **复制这个UUID**（格式类似：`a1b2c3d4-e5f6-7890-abcd-ef1234567890`）
   - ⚠️ **重要：** 保存好这个ID，下一步会用到！

---

### 步骤2：设置管理员角色

#### 2.1 打开 SQL Editor

1. **进入 SQL Editor**
   - 在左侧菜单中，找到 **SQL Editor**（图标：`>-`）
   - 点击 **SQL Editor**

2. **创建新查询**
   - 点击 **New query**（新建查询）
   - 或点击 **+ New** 按钮

#### 2.2 执行SQL设置角色

1. **复制以下SQL代码**

```sql
-- 创建用户资料并设置为管理员
-- 替换 YOUR_USER_ID 为刚才复制的用户ID

INSERT INTO user_profiles (id, full_name, role)
VALUES ('YOUR_USER_ID', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

2. **替换用户ID**
   - 将 `YOUR_USER_ID` 替换为步骤1.3中复制的实际用户ID
   - 例如：
   ```sql
   INSERT INTO user_profiles (id, full_name, role)
   VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Admin User', 'admin')
   ON CONFLICT (id) DO UPDATE SET role = 'admin';
   ```

3. **执行SQL**
   - 将修改后的SQL粘贴到SQL Editor
   - 点击 **Run**（运行）按钮
   - 或按快捷键 `Ctrl + Enter`（Windows）或 `Cmd + Enter`（Mac）

4. **验证结果**
   - 应该看到成功消息：`Success. No rows returned` 或 `Success. 1 row affected`
   - 如果看到错误，检查用户ID是否正确

---

### 步骤3：验证管理员账户

#### 3.1 检查用户资料

1. **打开 Table Editor**
   - 在左侧菜单中，点击 **Table Editor**（表格图标）
   - 选择 **user_profiles** 表

2. **查看管理员记录**
   - 应该能看到一条记录
   - **id**: 你创建的用户ID
   - **full_name**: `Admin User`
   - **role**: `admin` ✅

#### 3.2 测试登录（可选）

1. **访问登录页面**
   - 打开 `http://localhost:3000/admin`
   - 或 `http://localhost:3000/signin`

2. **使用管理员账户登录**
   - Email: `admin@atockorea.com`
   - Password: 你设置的密码

3. **验证权限**
   - 登录成功后，应该能访问总台后台
   - 可以看到所有功能模块

---

## 🖼️ 可视化步骤

### 步骤1：创建用户

```
Supabase Dashboard
  └── 左侧菜单
      └── Authentication (🔒)
          └── Users 标签
              └── Add user 按钮
                  └── 填写信息
                      ├── Email: admin@atockorea.com
                      ├── Password: [你的密码]
                      └── ✅ Auto Confirm User
                  └── Create user
                      └── 复制 User UID
```

### 步骤2：设置角色

```
Supabase Dashboard
  └── 左侧菜单
      └── SQL Editor (>-)
          └── New query
              └── 粘贴SQL
                  └── 替换 YOUR_USER_ID
                      └── Run
                          └── ✅ Success
```

---

## 📝 SQL 示例（完整版）

### 示例1：基本设置

```sql
-- 假设用户ID是：a1b2c3d4-e5f6-7890-abcd-ef1234567890

INSERT INTO user_profiles (id, full_name, role)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

### 示例2：如果用户资料已存在

```sql
-- 如果用户资料已存在，直接更新角色
UPDATE user_profiles
SET role = 'admin', full_name = 'Admin User'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
```

### 示例3：检查用户是否存在

```sql
-- 先检查用户是否存在
SELECT id, email FROM auth.users WHERE email = 'admin@atockorea.com';
```

---

## ⚠️ 常见问题

### Q1: 找不到 "Add user" 按钮？

**A:** 
- 确保你在 **Authentication** → **Users** 页面
- 如果还是没有，检查你的账户权限
- 尝试刷新页面

### Q2: "Auto Confirm User" 选项在哪里？

**A:**
- 在创建用户的对话框中
- 可能显示为复选框或开关
- 如果找不到，用户创建后可以在用户详情页面手动确认

### Q3: 如何找到用户ID？

**A:**
- 在 **Authentication** → **Users** 页面
- 点击用户邮箱或用户行
- 在用户详情页面找到 **User UID** 或 **ID**
- 也可以使用SQL查询：
  ```sql
  SELECT id, email FROM auth.users WHERE email = 'admin@atockorea.com';
  ```

### Q4: SQL执行失败，提示"violates foreign key constraint"？

**A:**
- 确保用户已创建（在 auth.users 表中）
- 检查用户ID是否正确
- 确保用户已确认（Auto Confirm User 已勾选）

### Q5: 如何验证管理员角色已设置？

**A:**
- 在 **Table Editor** → **user_profiles** 表中查看
- 使用SQL查询：
  ```sql
  SELECT id, full_name, role FROM user_profiles WHERE role = 'admin';
  ```

### Q6: 可以创建多个管理员吗？

**A:**
- 可以！重复步骤1和步骤2即可
- 每个管理员都需要：
  1. 在 Authentication 中创建用户
  2. 在 user_profiles 中设置 role = 'admin'

---

## ✅ 完成检查清单

- [ ] 已在 Authentication → Users 中创建用户
- [ ] 已勾选 "Auto Confirm User"
- [ ] 已复制用户ID（UUID）
- [ ] 已在 SQL Editor 中执行设置角色的SQL
- [ ] SQL执行成功（无错误）
- [ ] 已在 Table Editor 中验证 user_profiles 表
- [ ] role 字段显示为 'admin'
- [ ] 可以访问 `http://localhost:3000/admin`

---

## 🎯 下一步

管理员创建成功后：

1. ✅ **访问总台后台**
   - `http://localhost:3000/admin`
   - 使用管理员账户登录

2. ✅ **创建商家账户**
   - 在总台后台 → 商家管理 → 添加新商家
   - 或运行 `npm run create-merchant`

3. ✅ **开始使用系统**
   - 管理商家
   - 查看数据
   - 配置系统

---

## 📚 相关文档

- `docs/SUPABASE_COMPLETE_SETUP.md` - 完整设置指南
- `docs/ACCESS_GUIDE.md` - 访问指南
- `docs/HOW_TO_GET_API_KEYS.md` - API Keys 获取指南

祝你使用愉快！🎉

