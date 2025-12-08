# Supabase Dashboard 导航指南

## 🎯 重要：先进入项目！

如果你看到的是组织级别的菜单（Projects、Team、Billing等），需要先进入项目。

### 步骤1：进入项目

1. **在左侧菜单中，点击 "Projects"**
   - 你会看到项目列表
   - 找到你的项目（如：`atockorea`）

2. **点击项目名称**
   - 进入项目内部

3. **现在你应该看到项目级别的菜单**：
   - Project Overview
   - Table Editor
   - SQL Editor
   - Database
   - **Authentication** ← 在这里！
   - Storage
   - Edge Functions
   - 等等...

---

## 📍 找到 Authentication 的步骤

### 方法1：通过左侧菜单

1. **确保你在项目内部**（不是组织级别）
2. **在左侧菜单中查找**
   - 向下滚动查找
   - 找到 **Authentication**（锁图标 🔒）
   - 通常在 **Database** 和 **Storage** 之间

### 方法2：如果还是找不到

1. **检查项目是否已创建**
   - 如果项目列表是空的，需要先创建项目
   - 参考：`docs/SUPABASE_COMPLETE_SETUP.md` 步骤1.2

2. **检查账户权限**
   - 确保你是项目的所有者或管理员
   - 如果是团队成员，可能没有权限

3. **尝试搜索**
   - 在 Supabase Dashboard 顶部可能有搜索框
   - 搜索 "Authentication" 或 "Users"

---

## 🔍 详细菜单位置

### 项目级别菜单（进入项目后）

当你进入项目后，左侧菜单应该显示：

```
📊 Project Overview
📋 Table Editor
💻 SQL Editor
🗄️ Database
🔒 Authentication  ← 在这里！
📁 Storage
⚡ Edge Functions
🔄 Realtime
💡 Advisors
🔭 Observability
📝 Logs
📄 API Docs
🔗 Integrations
⚙️ Project Settings
```

### 如果看到的是组织级别菜单

```
📦 Projects  ← 点击这里进入项目
👥 Team
🔗 Integrations
📈 Usage
💳 Billing
⚙️ Organization settings
```

**解决方法：** 点击 **Projects**，然后选择你的项目。

---

## 🎯 创建用户的替代方法

如果找不到 Authentication 菜单，可以尝试：

### 方法1：通过 SQL 直接创建用户

1. **打开 SQL Editor**
   - 左侧菜单 → **SQL Editor**

2. **执行以下SQL**（需要 service_role 权限）

```sql
-- 注意：这个方法需要 service_role key，通常通过 API 调用
-- 推荐使用方法2
```

### 方法2：通过 Supabase CLI（高级）

如果你安装了 Supabase CLI：

```bash
supabase auth users create admin@atockorea.com --password your_password
```

### 方法3：通过 API（推荐用于脚本）

使用我们创建的脚本：

```bash
npm run create-merchant
```

这个脚本会自动创建用户并设置角色。

---

## 🆘 如果还是找不到

### 检查清单

1. **确认你在正确的项目**
   - [ ] 左侧菜单显示项目级别的选项（Table Editor, SQL Editor等）
   - [ ] 不是组织级别的选项（Projects, Team, Billing）

2. **确认项目已创建**
   - [ ] 项目列表中有你的项目
   - [ ] 项目状态是 "Active"

3. **尝试刷新页面**
   - [ ] 按 F5 刷新
   - [ ] 清除浏览器缓存

4. **检查浏览器控制台**
   - [ ] 按 F12 打开开发者工具
   - [ ] 查看 Console 标签是否有错误

---

## 📸 截图指引

### 正确的视图应该是：

**项目级别菜单（进入项目后）：**
- 左侧菜单应该显示：Project Overview, Table Editor, SQL Editor, Database, **Authentication**, Storage...

**如果看到的是：**
- Projects, Team, Integrations, Usage, Billing...
- **说明你在组织级别，需要点击 Projects 进入项目**

---

## 🎯 快速解决方案

### 最简单的方法：

1. **直接使用 SQL Editor 创建用户资料**
   - 如果你已经有 Supabase 账户（通过其他方式创建）
   - 或者先创建用户，然后设置角色

2. **使用我们提供的脚本**
   ```bash
   npm run create-merchant
   ```
   - 这个脚本会自动处理所有步骤

---

## 💡 提示

如果你在 Supabase Dashboard 中看到的是：
- ✅ **项目级别菜单** → 继续查找 Authentication
- ❌ **组织级别菜单** → 点击 Projects，选择项目

请告诉我你现在看到的是哪个菜单，我可以提供更具体的帮助！

