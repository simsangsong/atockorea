# 修复 SQL UUID 错误

## ❌ 错误信息

```
ERROR: 42601: trailing junk after numeric literal at or near "5e901bcc"
LINE 1: 5e901bcc-ca4d-4eb0-b1cc-64b10829cbfa
```

## 🔍 问题原因

UUID 在 SQL 中必须用**单引号**括起来。你直接粘贴了 UUID，SQL 把它当作数字处理了。

## ✅ 正确的 SQL

### 错误的写法：
```sql
5e901bcc-ca4d-4eb0-b1cc-64b10829cbfa
```

### 正确的写法：
```sql
INSERT INTO user_profiles (id, full_name, role)
VALUES ('5e901bcc-ca4d-4eb0-b1cc-64b10829cbfa', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

**注意：** UUID 用单引号 `'...'` 括起来！

---

## 📝 完整步骤

### 步骤1：复制你的用户ID

你的用户ID是：`5e901bcc-ca4d-4eb0-b1cc-64b10829cbfa`

### 步骤2：使用正确的 SQL

在 SQL Editor 中，复制并粘贴以下 SQL：

```sql
INSERT INTO user_profiles (id, full_name, role)
VALUES ('5e901bcc-ca4d-4eb0-b1cc-64b10829cbfa', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

**重要：**
- ✅ UUID 用单引号括起来：`'5e901bcc-ca4d-4eb0-b1cc-64b10829cbfa'`
- ✅ 整个 VALUES 部分用括号括起来
- ✅ 最后有分号 `;`

### 步骤3：执行 SQL

1. 点击 **Run** 按钮
2. 应该看到：`Success. No rows returned` 或 `Success. 1 row affected`

---

## 🎯 快速修复模板

如果你的用户ID不同，使用这个模板：

```sql
INSERT INTO user_profiles (id, full_name, role)
VALUES ('你的用户ID', 'Admin User', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

**替换说明：**
- 将 `你的用户ID` 替换为实际的 UUID
- **记住：** UUID 必须用单引号括起来！

---

## ✅ 验证

执行成功后，验证管理员是否创建：

```sql
SELECT id, full_name, role FROM user_profiles WHERE role = 'admin';
```

应该能看到你的管理员记录。

---

## 🆘 如果还有错误

### 错误1：用户不存在

如果提示用户不存在，先检查用户是否已创建：

```sql
SELECT id, email FROM auth.users WHERE email = 'admin@atockorea.com';
```

### 错误2：表不存在

如果提示表不存在，先执行完整的 schema：

1. 打开 `supabase/complete-schema.sql`
2. 复制全部内容
3. 在 SQL Editor 中执行

---

## 📚 相关文档

- `docs/CREATE_ADMIN_STEP_BY_STEP.md` - 完整创建步骤
- `docs/SUPABASE_COMPLETE_SETUP.md` - 完整设置指南

