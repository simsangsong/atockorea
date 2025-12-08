# Kakao Redirect URI 配置指南

## 🎯 当前位置

你在 **"카카오 로그인" → "일반" (General)** 页面。

✅ **카카오 로그인 已启用**（状态：ON）

---

## 📍 找到 Redirect URI 设置

### 方法1：在当前页面查找

1. **向下滚动页面**
   - Redirect URI 设置可能在这个页面的下方
   - 查找 **"Redirect URI"** 或 **"리디렉션 URI"** 部分

2. **查找相关设置**
   - 可能显示为 **"Redirect URI 등록"** (Register Redirect URI)
   - 或 **"리디렉션 URI 설정"** (Redirect URI Settings)

### 方法2：检查其他标签页

在 카카오 로그인 设置中，可能有多个标签页：

1. **일반** (General) - 你当前在这里
2. **동의항목** (Consent Items) - 可能包含 Redirect URI
3. **간편가입** (Easy Signup) - 可能包含 Redirect URI

**尝试：**
- 点击 **"동의항목"** (Consent Items) 查看是否有 Redirect URI 设置

### 方法3：先配置 Web 平台

Redirect URI 可能需要先注册 Web 平台：

1. **左侧菜单** → **앱 설정** → **플랫폼** (Platform)
2. **添加 Web 平台**
   - 点击 **"Web 플랫폼 추가"** (Add Web Platform)
   - 사이트 도메인: `cghyvbwmijqpahnoduyv.supabase.co`
   - 保存后，Redirect URI 设置可能会出现

---

## 🔧 配置步骤（按顺序）

### 步骤1：注册 Web 平台（如果还没做）

1. **左侧菜单** → **앱 설정** → **플랫폼** (Platform)
2. **添加 Web 平台**
   - 点击 **"Web 플랫폼 추가"** (Add Web Platform)
   - 사이트 도메인 (Site Domain):
     ```
     cghyvbwmijqpahnoduyv.supabase.co
     ```
   - 点击 **"저장"** (Save)

### 步骤2：配置 Redirect URI

**选项A：在 일반页面**
- 向下滚动查找 Redirect URI 设置
- 或查找 **"Redirect URI 등록"** 按钮

**选项B：在 동의항목页面**
- 左侧菜单 → **제품 설정** → **카카오 로그인** → **동의항목** (Consent Items)
- 查看是否有 Redirect URI 设置

**选项C：在平台设置中**
- 左侧菜单 → **앱 설정** → **플랫폼** (Platform)
- 在 Web 平台设置中可能有 Redirect URI

### 步骤3：添加 Redirect URI

找到 Redirect URI 设置后：

1. **添加 URI**
   - 输入：
     ```
     https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback
     ```
2. **保存**
   - 点击 **"저장"** (Save) 或 **"등록"** (Register)

---

## 🔍 获取 REST API Key

### 步骤1：进入 앱 키 页面

1. **左侧菜单** → **앱 설정** → **플랫폼 키** (Platform Key)
   - 或 **앱 키** (App Keys)

### 步骤2：复制 REST API Key

1. **找到 REST API 키**
   - 显示在页面顶部或明显位置
   - 格式：字符串

2. **复制 Key**
   - 稍后在 Supabase 中会用到

---

## ✅ 配置检查清单

- [ ] Web 平台已注册
- [ ] 사이트 도메인已配置
- [ ] Redirect URI 已找到并添加
- [ ] REST API Key 已复制
- [ ] Supabase 中已配置

---

## 🆘 如果还是找不到 Redirect URI

### 可能的原因

1. **需要先注册 Web 平台**
   - 必须先注册 Web 平台，Redirect URI 设置才会出现

2. **界面版本不同**
   - 不同版本的 Kakao Developers 界面可能不同
   - 尝试查找 "OAuth" 或 "인증" 相关设置

3. **在平台设置中**
   - Redirect URI 可能在 **앱 설정** → **플랫폼** → Web 平台设置中

### 建议操作

1. **先注册 Web 平台**
   - 앱 설정 → 플랫폼 → Web 플랫폼 추가

2. **然后查找 Redirect URI**
   - 可能在 Web 平台设置中
   - 或在 카카오 로그인 → 동의항목 中

---

## 📝 快速参考

### 需要配置的地方

1. **Web 平台**
   - 앱 설정 → 플랫폼 → Web 플랫폼 추가
   - 사이트 도메인: `cghyvbwmijqpahnoduyv.supabase.co`

2. **Redirect URI**
   - 可能在：카카오 로그인 → 일반 或 동의항목
   - 或：앱 설정 → 플랫폼 → Web 平台设置
   - URI: `https://cghyvbwmijqpahnoduyv.supabase.co/auth/v1/callback`

3. **REST API Key**
   - 앱 설정 → 플랫폼 키 或 앱 키
   - 复制 REST API 키

---

## 🎯 下一步

1. **先注册 Web 平台**（如果还没做）
2. **查找并配置 Redirect URI**
3. **获取 REST API Key**
4. **在 Supabase 中配置**

需要我继续指导哪个步骤？

