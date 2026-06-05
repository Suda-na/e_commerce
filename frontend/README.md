# 实时竞拍大师 - 商家控制台

基于 React 19 + TypeScript 5.x + Ant Design 5.x 的商家端 Web 应用。

## 技术栈

- **前端框架**: React 19
- **开发语言**: TypeScript 5.x
- **UI框架**: Ant Design 5.x
- **状态管理**: Redux Toolkit
- **HTTP客户端**: Axios
- **实时通信**: Socket.IO Client
- **路由**: React Router DOM v7
- **构建工具**: Create React App

## 功能模块

### 1. 用户认证
- 商家登录/注册
- 个人信息管理
- Token 自动续期

### 2. 商品管理
- 商品列表查看
- 创建/编辑/删除商品
- AI 智能描述生成
- 商品状态管理

### 3. 竞拍管理
- 竞拍列表查看
- 创建竞拍活动
- 开始/结束/取消竞拍
- 实时竞拍状态监控
- 实时排行榜查看

### 4. 订单管理
- 订单列表查看
- 订单详情查看
- 订单状态管理
- 模拟支付功能

### 5. AI 智能助手
- 商品描述自动生成
- 直播话术建议
- 话术模板管理

### 6. 数据统计
- 竞拍数据概览
- 订单统计
- 收入统计

## 项目结构

```
frontend/
├── public/                 # 静态资源
├── src/
│   ├── assets/            # 资源文件
│   ├── components/        # 公共组件
│   │   └── Layout/        # 布局组件
│   ├── pages/             # 页面组件
│   │   ├── AI/            # AI助手页面
│   │   ├── Auctions/      # 竞拍管理页面
│   │   ├── Dashboard/     # 数据看板页面
│   │   ├── Login/         # 登录页面
│   │   ├── Orders/        # 订单管理页面
│   │   ├── Products/      # 商品管理页面
│   │   └── Profile/       # 个人信息页面
│   ├── services/          # API服务
│   ├── store/             # Redux状态管理
│   │   └── slices/        # Redux切片
│   ├── types/             # TypeScript类型定义
│   ├── utils/             # 工具函数
│   ├── App.tsx            # 主应用组件
│   └── index.tsx          # 入口文件
├── .env                   # 环境变量
├── .env.example           # 环境变量示例
├── package.json           # 依赖配置
└── tsconfig.json          # TypeScript配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并根据实际情况修改配置：

```bash
cp .env.example .env
```

### 3. 启动开发服务器

```bash
npm start
```

应用将在 http://localhost:3000 启动。

### 4. 构建生产版本

```bash
npm run build
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| REACT_APP_API_URL | 后端API地址 | http://localhost:3001/api |
| REACT_APP_SOCKET_URL | Socket.IO服务器地址 | http://localhost:3001 |
| REACT_APP_NAME | 应用名称 | 实时竞拍大师 - 商家控制台 |
| REACT_APP_VERSION | 应用版本 | 1.0.0 |

## 开发规范

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用函数式组件和 Hooks
- 使用 Redux Toolkit 进行状态管理

### 组件规范
- 每个页面组件独立目录
- 使用 index.tsx 作为页面入口
- 组件使用 PascalCase 命名
- 工具函数使用 camelCase 命名

### 样式规范
- 使用 Ant Design 组件库
- 使用 CSS-in-JS 方案
- 遵循响应式设计原则

## 后端服务

本项目需要配合后端服务使用，请确保后端服务已启动并运行在正确端口。

后端服务默认地址: http://localhost:3001

## 浏览器支持

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 许可证

MIT License
