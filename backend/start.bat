@echo off
chcp 65001 >nul
echo ========================================
echo 直播竞拍全栈系统后端服务启动脚本
echo ========================================
echo.

echo [1/4] 检查 Node.js 版本...
node --version
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)

echo.
echo [2/4] 安装项目依赖...
echo 这可能需要几分钟时间，请耐心等待...
call npm install
if %errorlevel% neq 0 (
    echo 错误: 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [3/4] 检查环境变量配置...
if not exist .env (
    echo 警告: 未找到 .env 文件，正在从模板创建...
    copy .env.example .env
    echo 请编辑 .env 文件配置数据库和Redis连接信息
    echo.
    pause
)

echo.
echo [4/5] 清理端口 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo 发现端口 3001 被 PID:%%a 占用，正在强制释放...
    taskkill /PID %%a /F >nul 2>&1
    echo 端口 3001 已释放
)
ping 127.0.0.1 -n 2 >nul

echo.
echo [5/5] 启动开发服务器...
echo 服务器将在 http://localhost:3001 启动
echo 健康检查: http://localhost:3001/health
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

call npm run dev