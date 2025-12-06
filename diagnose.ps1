# AtoCKorea 诊断脚本
Write-Host "=== AtoCKorea 诊断工具 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 检查文件是否存在
Write-Host "1. 检查 app/page.tsx 文件..." -ForegroundColor Yellow
if (Test-Path "app/page.tsx") {
    $content = Get-Content "app/page.tsx" -Raw
    if ($content -match "更新成功") {
        Write-Host "   ✅ 文件存在且包含测试代码" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 文件存在但不包含测试代码" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ 文件不存在！" -ForegroundColor Red
}

# 2. 检查 .next 缓存
Write-Host ""
Write-Host "2. 检查 .next 缓存..." -ForegroundColor Yellow
if (Test-Path ".next") {
    Write-Host "   ⚠️  .next 缓存存在，建议清除" -ForegroundColor Yellow
    Write-Host "   运行: Remove-Item -Recurse -Force .next" -ForegroundColor Gray
} else {
    Write-Host "   ✅ .next 缓存不存在" -ForegroundColor Green
}

# 3. 检查 Node 进程
Write-Host ""
Write-Host "3. 检查 Node.js 进程..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "   ✅ 发现 $($nodeProcesses.Count) 个 Node.js 进程" -ForegroundColor Green
    $nodeProcesses | ForEach-Object {
        Write-Host "      - PID: $($_.Id), 启动时间: $($_.StartTime)" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ 没有运行中的 Node.js 进程" -ForegroundColor Red
    Write-Host "   请运行: npm run dev" -ForegroundColor Gray
}

# 4. 检查端口 3000
Write-Host ""
Write-Host "4. 检查端口 3000..." -ForegroundColor Yellow
$port3000 = netstat -ano | Select-String ":3000"
if ($port3000) {
    Write-Host "   ✅ 端口 3000 正在使用" -ForegroundColor Green
} else {
    Write-Host "   ❌ 端口 3000 未被占用" -ForegroundColor Red
    Write-Host "   开发服务器可能没有运行" -ForegroundColor Gray
}

# 5. 获取 IP 地址
Write-Host ""
Write-Host "5. 获取本机 IP 地址..." -ForegroundColor Yellow
$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } | Select-Object -First 1).IPAddress
if ($ipAddress) {
    Write-Host "   ✅ 本机 IP: $ipAddress" -ForegroundColor Green
    Write-Host "   手机访问地址: http://$ipAddress:3000" -ForegroundColor Cyan
} else {
    Write-Host "   ⚠️  无法获取 IP 地址" -ForegroundColor Yellow
}

# 6. 检查 package.json 配置
Write-Host ""
Write-Host "6. 检查 package.json 配置..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    if ($packageJson.scripts.dev -match "0.0.0.0") {
        Write-Host "   ✅ dev 脚本已配置为允许外部访问" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  dev 脚本未配置外部访问" -ForegroundColor Yellow
        Write-Host "   建议修改为: next dev -H 0.0.0.0" -ForegroundColor Gray
    }
} else {
    Write-Host "   ❌ package.json 不存在" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 诊断完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "建议操作步骤:" -ForegroundColor Yellow
Write-Host "1. 停止所有 Node.js 进程" -ForegroundColor White
Write-Host "2. 清除缓存: Remove-Item -Recurse -Force .next" -ForegroundColor White
Write-Host "3. 重新启动: npm run dev" -ForegroundColor White
Write-Host "4. 在浏览器访问: http://localhost:3000" -ForegroundColor White
Write-Host "5. 在手机访问: http://$ipAddress:3000" -ForegroundColor White

