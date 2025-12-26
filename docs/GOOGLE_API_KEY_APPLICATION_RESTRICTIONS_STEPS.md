# Google API Key Application Restrictions 设置步骤（基于截图）

## 📸 当前状态

从你的截图可以看到：
- ✅ **API restrictions** 已正确设置（选择了 32 个 API）
- ⚠️ **Application restrictions** 当前是 "없음" (None) - **需要修改**

---

## 🔧 设置步骤

### 步骤 1：修改 Application Restrictions

1. **在 API Key 编辑页面找到 "애플리케이션 제한사항" (Application Restrictions) 部分**

2. **点击 "웹사이트" (Websites) 单选按钮**
   - 当前选择的是 "없음" (None)
   - 需要改为 "웹사이트" (Websites)

3. **点击后会显示 "웹사이트 제한사항" (Website Restrictions) 输入框**

---

### 步骤 2：添加网站限制

1. **点击 "항목 추가" (Add item) 或输入框**

2. **添加以下网站（每行一个）：**

   ```
   http://localhost:3000/*
   https://atockorea.com/*
   https://www.atockorea.com/*
   https://*.vercel.app/*
   ```
   
   ⚠️ **重要:** `www.atockorea.com` 和 `atockorea.com` **都需要**添加！

3. **格式说明：**
   - `http://localhost:3000/*` - 本地开发环境
   - `https://atockorea.com/*` - 生产环境
   - `https://*.vercel.app/*` - Vercel 预览环境（所有子域名）

---

### 步骤 3：保存更改

1. **滚动到页面底部**

2. **点击 "저장" (Save) 按钮**

3. **等待保存完成**
   - 通常会显示 "저장됨" (Saved) 提示
   - 更改可能需要几分钟生效

---

## 📋 完整配置清单

### Application Restrictions（애플리케이션 제한사항）

**选择：** ✅ 웹사이트 (Websites)

**添加的网站：**
```
http://localhost:3000/*
https://atockorea.com/*
https://*.vercel.app/*
```

### API Restrictions（API 제한사항）

**当前状态：** ✅ 키 제한 (Restrict key)

**已选择的 API（32개）：**
- ✅ Maps JavaScript API
- ✅ Places API
- ✅ Geocoding API
- ✅ Directions API
- ✅ 其他 Maps Platform API
- （保持现有选择即可）

---

## ⚠️ 重要提示

### 为什么需要设置 Application Restrictions？

1. **安全性**
   - 防止其他人使用你的 API Key
   - 限制只有你的网站可以使用

2. **费用控制**
   - 防止未授权使用导致费用超支
   - 只允许指定域名使用

3. **最佳实践**
   - Google 强烈建议设置限制
   - 提高整体安全性

---

## 🔍 验证设置

### 1. 检查设置是否正确

保存后，确认：
- ✅ Application restrictions: "웹사이트" (Websites)
- ✅ 已添加 3 个网站限制
- ✅ API restrictions: "키 제한" (Restrict key)
- ✅ 已选择需要的 API

### 2. 测试功能

1. **等待 5-10 分钟**（让更改生效）

2. **测试本地开发**
   - 访问 `http://localhost:3000`
   - 打开浏览器控制台（F12）
   - 确认没有 API Key 限制错误

3. **测试生产环境**
   - 访问 `https://atockorea.com`
   - 确认地图功能正常

---

## 🐛 常见问题

### Q1: 添加网站后还是显示错误？

**A:** 
- 等待 5-10 分钟让更改生效
- 检查网站格式是否正确
- 确认包含 `http://` 或 `https://`
- 确认末尾有 `/*`

### Q2: 本地开发无法使用？

**A:**
- 确认已添加 `http://localhost:3000/*`
- 检查端口号是否正确
- 如果使用其他端口，添加对应的限制

### Q3: Vercel 预览无法使用？

**A:**
- 确认已添加 `https://*.vercel.app/*`
- 或者添加具体的预览 URL

---

## 📝 快速操作清单

- [ ] 点击 "웹사이트" (Websites) 单选按钮
- [ ] 添加 `http://localhost:3000/*`
- [ ] 添加 `https://atockorea.com/*`
- [ ] 添加 `https://*.vercel.app/*`
- [ ] 点击 "저장" (Save) 按钮
- [ ] 等待 5-10 分钟
- [ ] 测试功能是否正常

---

## ✅ 完成后的效果

设置完成后，你的 API Key 将：
- ✅ 只能在你指定的网站上使用
- ✅ 只能访问你选择的 API
- ✅ 更安全，防止未授权使用
- ✅ 符合 Google 安全最佳实践

---

**完成！** 按照这些步骤设置后，你的 API Key 就安全了。🔒

