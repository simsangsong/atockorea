# Android App: Live Sync with Website & Google Play Store Compliance

本文说明如何让 **网站与 Android App 高度一致**、**实时同步**，并满足 **Google Play 政策**。

---

## 1. 网站与 App 一致 + 实时同步

### 方案：App 内加载线上网站 (Live URL)

- 使用 **Capacitor** 的 `server.url`，让 Android 应用内的 WebView **直接加载生产环境网站**（例如 `https://www.atockorea.com`）。
- **效果**：
  - 网站和 App **共用同一套前端**，UI/功能完全一致。
  - 网站有任何更新（内容、活动、价格等），**无需重新发版 App**，用户打开 App 即看到最新内容，实现 **实时同步**。

### 配置说明

- 已添加 **`capacitor.config.ts`**，其中：
  - `server.url`: 默认 `https://www.atockorea.com`，可通过环境变量 **`CAPACITOR_SERVER_URL`** 覆盖（例如测试环境）。
  - `allowNavigation`: 允许在 App 内跳转的域名（本站、Stripe、Supabase、Google 等），保证登录、支付、OAuth 在 WebView 内正常完成。

### 可选：嵌入打包 (Embedded) 模式

- 若希望 **完全离线** 或 **不依赖线上 URL**，可改为将 Next.js 打成静态包并嵌入 App（需在 `next.config.js` 中开启 `output: 'export'`，并执行 `npm run build` 后 `npx cap copy`）。
- 该模式下，“实时同步”需通过 **重新发版 App** 或 **OTA 更新** 才能更新内容；与“始终加载线上站”相比，更偏向离线与性能。

---

## 2. 一键生成 Android 工程并运行

### 首次初始化（仅需一次）

```bash
# 安装依赖（若尚未安装）
npm install

# Live URL 模式下若不打包静态站，需先创建空目录 out（Windows: mkdir out，macOS/Linux: mkdir -p out）

# 添加 Android 平台（会创建 android/ 目录）
npm run android:add
# 或: npx cap add android

# 将配置同步到 Android 项目
npm run android:sync
# 或: npx cap sync android
```

### 日常开发 / 打包

- **无需** 为“网站内容更新”而重新 build Next.js 或重新 sync；只要线上网站已更新，App 内刷新或重新打开即可看到最新内容。
- 仅当修改了 **Capacitor 配置**、**原生资源** 或 **插件** 时，需要再次执行：

```bash
npx cap sync android
```

- 在 Android Studio 中打开工程并运行/打包：

```bash
npx cap open android
```

- 在 Android Studio 中：**Build → Build Bundle(s) / APK(s) → Build APK(s)** 或 **Build App Bundle(s)**（上架 Play 建议用 AAB）。

### 环境变量（可选）

- 若希望 App 在 build 时指向 **测试/预发** 地址，可在执行 `npx cap sync android` 前设置：

```bash
# Windows (PowerShell)
$env:CAPACITOR_SERVER_URL="https://staging.atockorea.com"; npx cap sync android

# macOS / Linux
CAPACITOR_SERVER_URL=https://staging.atockorea.com npx cap sync android
```

---

## 3. Google Play Store 政策合规要点

以下为满足 Google Play 政策所需的主要事项，便于自查和上架。

### 3.1 必须提供

| 项目 | 说明 |
|------|------|
| **隐私政策 (Privacy Policy)** | 在 Play 控制台和 App 内（如设置页）提供可公开访问的 URL，说明收集的数据类型、用途、第三方共享等。 |
| **应用内容分级** | 在 Play Console 完成问卷，获取内容分级（如 IARC）。 |
| **目标 API 等级** | 当前要求 **targetSdkVersion 34**（或按 Google 当年要求）。Capacitor 默认会使用较新 SDK，请在 `android/app/build.gradle` 中确认。 |
| **数据安全表单** | 在 Play Console 中如实填写“数据安全”部分（是否收集数据、是否共享、是否可删除等）。 |

### 3.2 权限与行为

| 项目 | 说明 |
|------|------|
| **最小权限** | 只声明 App 实际需要的权限（如 `INTERNET`）。支付、登录等建议在 WebView 内用网站现有逻辑，避免重复要敏感权限。 |
| **非欺骗性行为** | App 描述、截图、功能说明需与真实体验一致；若为“网站封装 App”，建议在商店描述中说明“本应用提供与官网一致的浏览与预订体验”等。 |
| **用户数据** | 若通过网站收集邮箱、姓名、支付信息等，须在隐私政策中说明，并遵守当地法规（如 GDPR、CCPA）。 |

### 3.3 技术建议

- **仅加载受信任 URL**：`capacitor.config.ts` 中 `server.url` 与 `allowNavigation` 仅包含自有域名和必要的第三方（Stripe、Supabase、Google 等），避免任意外部站。
- **HTTPS**：生产环境务必使用 `https`，不要在生产中使用 `cleartext: true`。
- **Splash / 状态栏**：已配置 SplashScreen 插件，提升“原生 App”体验，减少“只是浏览器”的观感，有利于审核。

### 3.4 上架前自检清单

- [ ] 隐私政策 URL 已填写在 Play Console 和 App 内
- [ ] 内容分级问卷已完成
- [ ] 目标 SDK 满足 Google 当年要求（如 34）
- [ ] 数据安全表单已填写
- [ ] 仅声明必要权限（如 INTERNET）
- [ ] 商店描述与截图真实反映“网站一致 + 实时更新”的体验
- [ ] 测试账号（如需要）已提供给审核说明

---

## 4. 小结

- **一致性与实时更新**：通过 Capacitor 的 Live URL 模式，App 与网站共用同一线上版本，实现高度一致与实时同步。
- **Play Store**：提供隐私政策、内容分级、数据安全与正确权限，并如实描述 App 行为，即可满足政策要求。
- 首次运行请执行：`npx cap add android` → `npx cap sync android` → `npx cap open android`，再在 Android Studio 中构建 APK/AAB。
