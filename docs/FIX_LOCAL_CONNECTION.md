# 修复本地连接问题

## 🔍 问题诊断

### 检查1：端口是否被占用

```powershell
netstat -ano | findstr :3000
```

如果看到输出，说明端口被占用。

### 检查2：Node进程是否在运行

```powershell
Get-Process -Name node
```

如果有多个Node进程，可能需要清理。

---

## ✅ 解决方法

### 方法1：重启开发服务器（推荐）

#### 步骤1：停止所有Node进程

```powershell
# 停止所有Node进程
Get-Process -Name node | Stop-Process -Force
```

或者手动停止：
1. 打开任务管理器（Ctrl + Shift + Esc）
2. 找到所有 `node.exe` 进程
3. 右键 → 结束任务

#### 步骤2：清理端口

```powershell
# 查找占用3000端口的进程
netstat -ano | findstr :3000

# 停止该进程（替换PID为实际进程ID）
taskkill /F /PID [进程ID]
```

#### 步骤3：重新启动

```bash
npm run dev
```

### 方法2：使用不同端口

如果3000端口一直被占用，可以使用其他端口：

```bash
# 使用3001端口
npx next dev -p 3001
```

然后访问：`http://localhost:3001/admin`

### 方法3：清理并重新安装

如果以上都不行：

```bash
# 1. 停止所有进程
Get-Process -Name node | Stop-Process -Force

# 2. 删除node_modules和.next
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next

# 3. 重新安装
npm install

# 4. 重新启动
npm run dev
```

---

## 🎯 快速修复脚本

创建一个 `restart-dev.ps1` 文件：

```powershell
# 停止所有Node进程
Write-Host "Stopping Node processes..."
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# 等待2秒
Start-Sleep -Seconds 2

# 清理.next目录
Write-Host "Cleaning .next directory..."
if (Test-Path .next) {
    Remove-Item -Recurse -Force .next
}

# 重新启动
Write-Host "Starting dev server..."
npm run dev
```

运行：
```powershell
.\restart-dev.ps1
```

---

## 🔧 常见错误

### 错误1：Port 3000 is already in use

**解决：**
```powershell
# 停止占用端口的进程
netstat -ano | findstr :3000
taskkill /F /PID [进程ID]
```

### 错误2：Cannot find module

**解决：**
```bash
npm install
```

### 错误3：Build error

**解决：**
```bash
# 清理构建缓存
Remove-Item -Recurse -Force .next
npm run dev
```

---

## ✅ 验证

启动成功后，应该看到：

```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Network:      http://0.0.0.0:3000

✓ Ready in X seconds
```

然后访问：
- `http://localhost:3000` - 首页
- `http://localhost:3000/admin` - 总台后台

---

## 🆘 如果还是不行

### 检查清单

- [ ] Node.js 已安装（`node --version`）
- [ ] npm 已安装（`npm --version`）
- [ ] 依赖已安装（`npm install`）
- [ ] 端口3000未被其他程序占用
- [ ] 防火墙没有阻止
- [ ] 浏览器没有缓存问题（尝试无痕模式）

### 尝试其他端口

```bash
# 使用3001端口
PORT=3001 npm run dev
```

然后访问：`http://localhost:3001/admin`

---

## 📚 相关文档

- `VERCEL_DEPLOY.md` - 部署指南
- `docs/FIX_404_ADMIN.md` - 404错误修复

