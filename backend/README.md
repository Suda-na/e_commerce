# 直播竞拍全栈系统后端服务

## 项目简介

这是抖音电商直播竞拍全栈系统的后端服务，基于 Node.js + Express + TypeScript 构建。

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.x
- **框架**: Express.js 4.x
- **数据库**: MySQL 8.0+
- **缓存**: Redis 7.0+
- **实时通信**: Socket.IO
- **认证**: JWT
- **代码规范**: ESLint + Prettier
- **开发工具**: nodemon (热重载)

## 项目结构

```
backend/
├── src/
│   ├── config/          # 配置文件
│   │   ├── index.ts     # 主配置
│   │   ├── database.ts  # 数据库配置
│   │   └── redis.ts     # Redis配置
│   ├── controllers/     # 控制器层
│   ├── middleware/       # 中间件
│   │   ├── auth.ts      # 认证中间件
│   │   ├── errorHandler.ts # 错误处理
│   │   └── rateLimiter.ts  # 速率限制
│   ├── models/          # 数据模型
│   │   ├── User.ts      # 用户模型
│   │   ├── Product.ts   # 商品模型
│   │   ├── Auction.ts   # 竞拍模型
│   │   ├── Bid.ts       # 出价模型
│   │   ├── Order.ts     # 订单模型
│   │   └── index.ts     # 模型索引
│   ├── routes/          # 路由定义
│   │   ├── auth.routes.ts    # 认证路由
│   │   └── index.ts          # 路由索引
│   ├── services/        # 服务层
│   │   └── auth.service.ts   # 认证服务
│   ├── types/           # TypeScript类型定义
│   │   └── index.ts     # 类型索引
│   ├── utils/           # 工具函数
│   │   └── logger.ts    # 日志工具
│   └── app.ts           # 应用入口
├── .env                 # 环境变量
├── .eslintrc.js         # ESLint配置
├── .prettierrc          # Prettier配置
├── nodemon.json         # nodemon配置
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript配置
└── README.md            # 项目说明
```

## 快速开始

### 1. 环境要求

- Node.js 18.0 或更高版本
- MySQL 8.0 或更高版本
- Redis 7.0 或更高版本
- npm 或 yarn 包管理器

### 2. 安装依赖

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 或使用 yarn
yarn install
```

### 3. 环境配置

复制环境变量模板文件并配置：

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑环境变量
# 配置数据库连接、Redis连接、JWT密钥等
```

### 4. 数据库设置

```sql
# 创建数据库
CREATE DATABASE auction_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 创建数据库用户（可选）
CREATE USER 'auction_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON auction_db.* TO 'auction_user'@'localhost';
FLUSH PRIVILEGES;
```

### 5. 运行项目

```bash
# 开发模式（热重载）
npm run dev

# 构建项目
npm run build

# 生产模式
npm start

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## API 接口

### 认证接口

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `GET /api/auth/profile` - 获取个人信息
- `PUT /api/auth/profile` - 更新个人信息
- `POST /api/auth/refresh-token` - 刷新Token
- `POST /api/auth/logout` - 退出登录

### 商品接口

- `GET /api/products` - 获取商品列表
- `GET /api/products/:id` - 获取商品详情
- `POST /api/products` - 创建商品（商家）
- `PUT /api/products/:id` - 更新商品（商家）
- `DELETE /api/products/:id` - 删除商品（商家）

### 竞拍接口

- `GET /api/auctions` - 获取竞拍列表
- `GET /api/auctions/:id` - 获取竞拍详情
- `POST /api/auctions` - 创建竞拍（商家）
- `POST /api/auctions/:id/start` - 开始竞拍（商家）
- `POST /api/auctions/:id/end` - 结束竞拍（商家）
- `POST /api/auctions/:id/cancel` - 取消竞拍（商家）

### 出价接口

- `POST /api/bids` - 提交出价
- `GET /api/bids/user` - 获取用户出价历史
- `GET /api/bids/auction/:id` - 获取竞拍出价记录

### 订单接口

- `GET /api/orders` - 获取订单列表
- `GET /api/orders/:id` - 获取订单详情
- `POST /api/orders/:id/pay` - 模拟支付
- `POST /api/orders/:id/cancel` - 取消订单

### AI接口

- `POST /api/ai/generate-description` - 生成商品描述
- `GET /api/ai/bid-suggestion/:auctionId` - 获取出价建议
- `POST /api/ai/analyze-trend` - 分析竞拍趋势

## WebSocket 事件

### 客户端事件

- `join_auction` - 加入竞拍房间
- `leave_auction` - 离开竞拍房间
- `place_bid` - 提交出价

### 服务器事件

- `auction_status` - 竞拍状态推送
- `new_bid` - 新出价广播
- `leaderboard_update` - 排行榜更新
- `auction_update` - 竞拍数据更新
- `time_extended` - 竞拍延时通知
- `auction_ended` - 竞拍结束通知
- `outbid` - 被超越通知
- `user_joined` - 用户加入通知
- `user_left` - 用户离开通知
- `bid_error` - 出价错误通知

## 开发指南

### 添加新模块

1. 在 `models/` 目录创建数据模型
2. 在 `services/` 目录创建业务逻辑
3. 在 `controllers/` 目录创建控制器
4. 在 `routes/` 目录定义路由
5. 在 `routes/index.ts` 中注册路由

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码
- 编写清晰的注释和文档

### 错误处理

使用自定义错误类：

```typescript
import { ValidationError, AuthenticationError } from '../middleware/errorHandler';

// 抛出验证错误
throw new ValidationError('用户名不能为空');

// 抛出认证错误
throw new AuthenticationError('Token无效');
```

## 部署

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3001
CMD ["node", "dist/app.js"]
```

### 环境变量

生产环境必须配置以下环境变量：

- `NODE_ENV=production`
- `DB_HOST` - 数据库主机
- `DB_USER` - 数据库用户
- `DB_PASSWORD` - 数据库密码
- `DB_NAME` - 数据库名称
- `REDIS_HOST` - Redis主机
- `JWT_SECRET` - JWT密钥（必须修改）

## 监控

- 健康检查: `GET /health`
- 日志文件: `logs/app.log` 和 `logs/error.log`

## 常见问题

### 1. 数据库连接失败

检查数据库配置和 MySQL 服务是否启动。

### 2. Redis 连接失败

检查 Redis 配置和 Redis 服务是否启动。

### 3. 端口被占用

修改 `.env` 文件中的 `PORT` 配置。

### 4. JWT 错误

确保 `JWT_SECRET` 已正确配置。

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License