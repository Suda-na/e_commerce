# 实时竞拍大师 - 直播竞拍全栈系统

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![微信小程序](https://img.shields.io/badge/微信小程序-原生开发-green.svg)

**一个完整的直播竞拍全栈解决方案，支持高并发实时竞拍场景**

[功能特性](#功能特性) • [快速开始](#快速开始) • [技术架构](#技术架构) • [API文档](#api文档) • [部署指南](#部署指南)

</div>

---

## 这是什么？为谁而建？

**实时竞拍大师**是一个面向直播电商场景的全栈竞拍系统，专为以下用户打造：

- **直播电商商家**：需要一个强大的后台来管理竞拍商品、配置竞拍规则、实时监控竞拍过程、处理成交订单
- **直播间主播**：需要在直播过程中实时展示竞拍信息、与观众互动、营造紧张刺激的竞拍氛围
- **C端用户**：希望在微信小程序中便捷地参与竞拍、实时出价、查看竞拍结果、管理个人订单

**解决的核心问题**：

1. **高价值商品定价难题**：珠宝、艺术品、二手奢侈品等商品价值难以统一定价，竞拍能让市场动态定价最大化商品价值
2. **实时性要求**：直播间场景需要毫秒级数据同步，100+用户同时出价时不能出现数据延迟、排名错乱
3. **复杂规则实现**：0元起拍、加价幅度、封顶价、自动延时等规则需要零漏洞实现
4. **跨端体验一致性**：商家Web端和用户小程序端需要实时数据同步，体验一致

---

## 功能特性

### 核心功能一览

| 功能模块 | 解决的问题 | 技术实现 |
|---------|-----------|---------|
| **实时竞拍** | 多人同时出价时的数据同步 | WebSocket + Redis队列 + 乐观锁 |
| **智能延时** | 防止最后一秒狙击，保证公平性 | 自动延时10-30秒 + 实时广播 |
| **5层出价校验** | 防止无效出价和恶意操作 | 基础→状态→最低→封顶→智能提示 |
| **实时排行榜** | 用户随时了解自己的位置 | Redis缓存 + WebSocket推送 |
| **竞拍结果** | 中标/未中标的情绪反馈 | 彩带动画 + 振动反馈 + 自动跳转 |
| **订单管理** | 竞拍成交后的订单处理 | 自动生成 + 模拟支付 + 状态流转 |
| **数据分析** | 商家了解经营状况 | 多维度统计 + 可视化图表 |

### 用户端功能（微信小程序）

- **直播间观看**：视频播放 + 主播信息 + 实时弹幕
- **竞拍浏览**：商品列表 + 分类筛选 + 搜索功能
- **出价参与**：手动出价 + 快捷加价 + 智能提示
- **实时反馈**：倒计时 + 排行榜 + 出价被超越提醒
- **竞拍结果**：中标庆祝动画 / 未中标遗憾展示
- **订单管理**：订单列表 + 模拟支付 + 取消订单
- **个人中心**：编辑资料 + 出价历史 + 收藏管理 + 修改密码

### 商家端功能（Web管理后台）

- **商品管理**：商品CRUD + 多图上传 + 分类管理
- **竞拍管理**：上架竞拍 + 规则配置 + 开始/结束/取消
- **实时监控**：直播间管理 + 实时数据 + 排行榜
- **订单处理**：订单列表 + 发货 + 退款 + 备注
- **数据分析**：销售统计 + 竞拍分析 + 用户分析 + 数据导出
- **系统设置**：账号管理 + 运费模板 + 通知设置

---

## 演示与截图

### 演示地址

- **商家Web端**：http://localhost:3001（本地运行）
- **后端API**：http://localhost:3000（本地运行）
- **微信小程序**：使用微信开发者工具导入 `weixin/` 目录

### 核心截图

> 注：以下为功能示意图，实际效果请运行项目查看

#### 用户端（微信小程序）

| 发现页 | 直播间 | 出价面板 |
|-------|-------|---------|
| 商家列表展示 | 视频播放 + 竞拍列表 | 价格控制 + 智能提示 |
| 搜索筛选 | 实时弹幕 | 倒计时 + 排行榜 |

| 竞拍结果 | 订单列表 | 个人中心 |
|---------|---------|---------|
| 中标庆祝动画 | 状态筛选 | 用户信息 |
| 彩带飘落 | 模拟支付 | 功能列表 |

#### 商家端（Web管理后台）

| 控制台 | 商品管理 | 竞拍管理 |
|-------|---------|---------|
| 数据概览 | 商品列表 | 竞拍列表 |
| 趋势图表 | CRUD操作 | 规则配置 |

| 直播间监控 | 订单管理 | 数据分析 |
|-----------|---------|---------|
| 实时数据 | 订单列表 | 销售统计 |
| 排行榜 | 发货退款 | 图表展示 |

---

## 技术架构

### 整体架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   微信小程序端   │    │   商家Web前端    │    │   管理后台      │
│   (用户端)      │    │   (React)       │    │   (可选)        │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │      后端服务         │
                    │   (Node.js/Express)  │
                    │   RESTful + WebSocket │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
    ┌─────────▼─────────┐ ┌────▼────┐ ┌─────────▼─────────┐
    │     MySQL         │ │  Redis  │ │    文件存储        │
    │   (核心数据)      │ │ (缓存)  │ │   (图片/文件)     │
    └───────────────────┘ └─────────┘ └───────────────────┘
```

### 技术选型与取舍

| 层级 | 技术选型 | 为什么这么选 | 备选方案对比 |
|------|---------|-------------|-------------|
| **后端框架** | Node.js + Express + TypeScript | 异步I/O天然适合高并发实时场景，TypeScript提供类型安全，生态成熟 | Go：性能更好但开发效率低；Python：异步支持弱 |
| **数据库** | MySQL + Sequelize ORM | 关系型数据库保证数据一致性，Sequelize简化ORM操作，社区活跃 | PostgreSQL：功能更强但学习成本高；MongoDB：不适合关系型数据 |
| **缓存** | Redis | 高频读写场景（排行榜、在线人数、出价队列），内存数据库毫秒级响应 | Memcached：功能单一；本地缓存：不支持分布式 |
| **实时通信** | Socket.IO | 自动重连、房间隔离、命名空间支持，适合直播场景 | 原生WebSocket：需自己实现重连、房间等；SSE：单向通信 |
| **商家前端** | React + TypeScript + Ant Design | 组件化开发，状态管理清晰，Ant Design提供丰富UI组件 | Vue：生态略弱；Angular：学习成本高 |
| **用户端** | 微信小程序 | 原生性能，无需下载，适合移动端快速访问 | H5：性能弱；原生App：开发成本高 |
| **认证** | JWT + bcrypt | 无状态认证，密码加密存储，适合分布式架构 | Session：需要共享存储；OAuth：第三方依赖 |

### 核心技术亮点

#### 1. 高并发处理
```typescript
// Redis队列处理高频出价
const bidQueue = new RedisQueue('bid_queue');
await bidQueue.add({ auctionId, userId, amount, requestId });

// 乐观锁保证数据一致性
await Auction.update(
  { current_price: newPrice },
  { 
    where: { 
      id: auctionId, 
      current_price: oldPrice  // 乐观锁条件
    } 
  }
);
```

#### 2. WebSocket房间隔离
```typescript
// 直播间级隔离，互不干扰
socket.on('join_auction', (auctionId) => {
  socket.join(`auction_${auctionId}`);
  io.to(`auction_${auctionId}`).emit('user_joined', { userId });
});
```

#### 3. 5层出价校验
```typescript
// 前端校验链路
class BidValidator {
  validate(amount: number): ValidateResult {
    // 1. 基础校验
    if (!Number.isFinite(amount) || amount <= 0) {
      return { valid: false, error: '金额无效' };
    }
    
    // 2. 状态校验
    if (this.auction.status !== 'active') {
      return { valid: false, error: '竞拍未开始' };
    }
    
    // 3. 最低出价
    const minBid = this.auction.currentPrice + this.auction.priceIncrement;
    if (amount < minBid) {
      return { valid: false, error: `最低出价 ¥${minBid}` };
    }
    
    // 4. 封顶价校验
    if (this.auction.capPrice && amount > this.auction.capPrice) {
      return { valid: false, error: '已达封顶价' };
    }
    
    // 5. 智能提示
    const warnings = this.generateWarnings(amount);
    return { valid: true, warnings };
  }
}
```

#### 4. 自动延时机制
```typescript
// 结束前有人出价，时间自动延长
if (timeLeft < auction.delayTime) {
  const newEndTime = Date.now() + auction.delayTime * 1000;
  await auction.update({ end_time: new Date(newEndTime) });
  
  // 广播延时通知
  io.to(`auction_${auctionId}`).emit('time_extended', {
    auctionId,
    newEndTime,
    delaySeconds: auction.delayTime
  });
}
```

---

## 快速开始

### 环境要求

- **Node.js**：18.0+
- **MySQL**：8.0+
- **Redis**：6.0+
- **微信开发者工具**：最新版
- **pnpm/npm/yarn**：任选其一

### 1. 克隆项目

```bash
git clone https://github.com/your-username/e-commerce.git
cd e-commerce
```

### 2. 后端配置

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp security.env.example .env
# 编辑 .env 文件，配置数据库和Redis连接

# 数据库迁移
npm run build
node scripts/migrate.js

# 启动开发服务器
npm run dev
```

**环境变量配置** (`backend/.env`)：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=auction_db
DB_USER=root
DB_PASSWORD=your_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# 文件上传
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# 安全配置
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
```

### 3. 商家前端配置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

访问 http://localhost:3001

### 4. 微信小程序配置

```bash
cd weixin

# 安装依赖
npm install

# 使用微信开发者工具打开 weixin/ 目录
# 配置 app.ts 中的 baseUrl 和 socketUrl
```

**小程序配置** (`weixin/miniprogram/app.ts`)：

```typescript
globalData: {
  baseUrl: 'http://127.0.0.1:3000/api',
  socketUrl: 'http://127.0.0.1:3000',
  isLoggedIn: false,
  userInfo: null
}
```

> **注意**：微信开发者工具需要勾选"不校验合法域名"才能正常访问本地服务器

---

## 项目结构

```
e-commerceAI/
├── backend/                    # 后端服务
│   ├── src/
│   │   ├── config/            # 配置文件
│   │   ├── controllers/       # 控制器
│   │   ├── middleware/        # 中间件
│   │   ├── models/            # 数据模型
│   │   ├── routes/            # 路由定义
│   │   ├── services/          # 业务逻辑
│   │   ├── utils/             # 工具类
│   │   └── app.ts             # 应用入口
│   ├── uploads/               # 上传文件
│   └── package.json
├── frontend/                   # 商家Web前端
│   ├── src/
│   │   ├── components/        # 组件
│   │   ├── pages/             # 页面
│   │   ├── services/          # API服务
│   │   ├── store/             # Redux状态管理
│   │   └── App.tsx            # 应用入口
│   └── package.json
├── weixin/                     # 微信小程序
│   ├── miniprogram/
│   │   ├── components/        # 组件
│   │   ├── pages/             # 页面
│   │   ├── services/          # 服务层
│   │   ├── utils/             # 工具类
│   │   └── app.ts             # 应用入口
│   └── package.json
├── 需求分析文档/               # 需求文档
└── README.md                   # 项目说明
```

---

## API文档

### 认证API

```http
POST /api/auth/register    # 用户注册
POST /api/auth/login       # 用户登录
GET  /api/auth/profile     # 获取个人信息
PUT  /api/auth/profile     # 更新个人信息
POST /api/auth/change-password  # 修改密码
POST /api/auth/refresh-token    # 刷新Token
GET  /api/auth/merchants   # 获取商家列表
```

### 竞拍API

```http
GET  /api/auctions                    # 竞拍列表
GET  /api/auctions/:id                # 竞拍详情
POST /api/auctions/list-product/:id   # 上架竞拍
POST /api/auctions/:id/start          # 开始竞拍
POST /api/auctions/:id/complete       # 结束竞拍
POST /api/auctions/:id/cancel         # 取消竞拍
GET  /api/auctions/:id/leaderboard    # 排行榜
POST /api/auctions/:id/bid            # 出价
```

### 订单API

```http
GET  /api/orders              # 订单列表
GET  /api/orders/:id          # 订单详情
POST /api/orders/:id/pay      # 模拟支付
POST /api/orders/:id/cancel   # 取消订单
POST /api/orders/:id/ship     # 订单发货
POST /api/orders/:id/refund   # 订单退款
```

### WebSocket事件

```typescript
// 客户端→服务器
socket.emit('join_auction', auctionId);    // 加入竞拍房间
socket.emit('place_bid', { amount });      // 提交出价
socket.emit('leave_auction', auctionId);   // 离开竞拍房间

// 服务器→客户端
socket.on('new_bid', (data) => {});        // 新出价广播
socket.on('price_update', (data) => {});   // 价格更新
socket.on('time_extended', (data) => {});  // 竞拍延时
socket.on('auction_ended', (data) => {});  // 竞拍结束
socket.on('auction_won', (data) => {});    // 竞拍获胜
socket.on('outbid', (data) => {});         // 出价被超越
```

---

## 部署指南

### 开发环境

```bash
# 启动后端
cd backend && npm run dev

# 启动前端
cd frontend && npm start

# 微信小程序使用开发者工具打开 weixin/ 目录
```

### 生产环境

#### 1. 后端部署

```bash
# 构建
cd backend && npm run build

# 启动（使用PM2）
npm install -g pm2
pm2 start dist/app.js --name auction-backend

# 或使用Docker
docker build -t auction-backend .
docker run -d -p 3000:3000 auction-backend
```

#### 2. 前端部署

```bash
# 构建
cd frontend && npm run build

# 部署到Nginx
# 将 build/ 目录复制到 Nginx 静态文件目录
```

#### 3. Nginx配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/frontend;
        try_files $uri $uri/ /index.html;
    }

    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket代理
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 关键PR与贡献

### 主要PR列表

| PR编号 | 标题 | 状态 | 说明 |
|-------|------|------|------|
| #1 | 项目初始化与基础架构 | ✅ | 后端、前端、小程序基础框架搭建 |
| #2 | 用户认证模块 | ✅ | JWT认证、角色权限、Token刷新 |
| #3 | 商品管理模块 | ✅ | 商品CRUD、图片上传、分类管理 |
| #4 | 竞拍引擎核心 | ✅ | 竞拍状态机、规则校验、延时机制 |
| #5 | WebSocket实时通信 | ✅ | Socket.IO集成、房间管理、事件广播 |
| #6 | 出价系统优化 | ✅ | 5层校验、幂等性、Redis队列 |
| #7 | 订单管理模块 | ✅ | 订单生成、支付流程、发货退款 |
| #8 | 数据分析功能 | ✅ | 销售统计、竞拍分析、数据导出 |
| #9 | UI/UX优化 | ✅ | 动画效果、智能提示、用户体验 |
| #10 | 性能优化 | ✅ | 缓存策略、并发控制、数据库优化 |

### 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 常见问题

### Q: 如何修改数据库配置？

A: 编辑 `backend/.env` 文件，修改 `DB_HOST`、`DB_PORT`、`DB_NAME`、`DB_USER`、`DB_PASSWORD` 等配置项。

### Q: 如何配置Redis？

A: 编辑 `backend/.env` 文件，修改 `REDIS_HOST`、`REDIS_PORT`、`REDIS_PASSWORD` 等配置项。如果Redis无密码，留空即可。

### Q: 微信小程序无法连接后端？

A: 请确保：
1. 后端服务已启动
2. 微信开发者工具勾选"不校验合法域名"
3. `app.ts` 中的 `baseUrl` 和 `socketUrl` 配置正确
4. 使用 `127.0.0.1` 而不是 `localhost`

### Q: 如何添加新的竞拍规则？

A: 
1. 后端：修改 `backend/src/models/Auction.ts` 添加字段
2. 后端：修改 `backend/src/services/auction.service.ts` 添加规则校验
3. 前端：修改 `frontend/src/pages/Products/` 中的表单
4. 小程序：修改 `weixin/miniprogram/components/bid-panel/` 中的校验逻辑

### Q: 如何部署到生产环境？

A: 参考 [部署指南](#部署指南) 部分，主要步骤：
1. 配置生产环境变量
2. 构建前端和后端
3. 配置Nginx反向代理
4. 使用PM2管理后端进程
5. 配置HTTPS证书

---

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

## 联系方式

- **项目地址**：https://github.com/your-username/e-commerceAI
- **问题反馈**：https://github.com/your-username/e-commerceAI/issues
- **邮箱**：your-email@example.com

---

## 致谢

- [Express](https://expressjs.com/) - 后端框架
- [React](https://react.dev/) - 前端框架
- [Ant Design](https://ant.design/) - UI组件库
- [Socket.IO](https://socket.io/) - 实时通信
- [Sequelize](https://sequelize.org/) - ORM框架
- [Redis](https://redis.io/) - 缓存数据库

---

<div align="center">

**如果这个项目对你有帮助，请给一个 Star 支持一下！**

[![Star History Chart](https://api.star-history.com/svg?repos=your-username/e-commerceAI&type=Date)](https://star-history.com/#your-username/e-commerceAI&Date)

</div>
