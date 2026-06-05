#!/bin/bash
chcp 65001 >nul
echo "========================================"
echo "直播竞拍全栈系统后端服务启动脚本"
echo "========================================"
echo ""

echo "[1/4] 检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js 18+"
    exit 1
fi
node --version

echo ""
echo "[2/4] 安装项目依赖..."
echo "这可能需要几分钟时间，请耐心等待..."
if ! npm install; then
    echo "错误: 依赖安装失败"
    exit 1
fi

echo ""
echo "[3/4] 检查环境变量配置..."
if [ ! -f .env ]; then
    echo "警告: 未找到 .env 文件，正在从模板创建..."
    cp .env.example .env
    echo "请编辑 .env 文件配置数据库和Redis连接信息"
    echo ""
    read -p "按 Enter 继续..."
fi

echo ""
echo "[4/4] 启动开发服务器..."
echo "服务器将在 http://localhost:3001 启动"
echo "健康检查: http://localhost:3001/health"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

npm run dev