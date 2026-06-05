# 安全配置指南

本文档描述了直播竞拍全栈系统的安全配置和最佳实践。

## 目录

1. [安全架构概述](#安全架构概述)
2. [环境变量配置](#环境变量配置)
3. [安全中间件](#安全中间件)
4. [认证与授权](#认证与授权)
5. [输入验证](#输入验证)
6. [数据加密](#数据加密)
7. [审计日志](#审计日志)
8. [部署安全](#部署安全)
9. [安全检查清单](#安全检查清单)

## 安全架构概述

系统采用多层安全防护架构：

```
┌─────────────────────────────────────────────────────┐
│                   客户端请求                         │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│              安全中间件层                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  HTTPS重定向 │  │  安全头设置  │  │  CORS配置   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  请求ID生成  │  │  请求日志   │  │  用户代理验证│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│              验证与过滤层                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  输入验证   │  │  XSS防护    │  │  SQL注入防护 │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  CSRF防护   │  │  签名验证   │  │  频率限制    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│              认证与授权层                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  JWT认证    │  │  Token刷新  │  │  角色授权    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  资源权限   │  │  会话管理   │  │  账户锁定    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│              数据安全层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │  数据加密   │  │  日志脱敏   │  │  审计日志    │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  │
└───────────────┬─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────┐
│                   业务逻辑层                         │
└─────────────────────────────────────────────────────┘
```

## 环境变量配置

### 必需配置

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `JWT_SECRET` | Access Token密钥 | `your_jwt_secret_key_here` |
| `JWT_REFRESH_SECRET` | Refresh Token密钥 | `your_jwt_refresh_secret_key_here` |
| `DATA_ENCRYPTION_KEY` | 数据加密密钥 | `a1b2c3d4e5f6...` (64字符十六进制) |

### 生成安全密钥

```bash
# 生成JWT密钥
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# 生成数据加密密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 可选配置

```bash
# API签名验证
API_SIGNATURE_ENABLED=true
API_SIGNATURE_SECRET=your_api_signature_secret

# HTTPS配置
FORCE_HTTPS=true
SSL_KEY_PATH=/path/to/private.key
SSL_CERT_PATH=/path/to/certificate.crt

# 频率限制
RATE_LIMIT_MAX=100
LOGIN_RATE_LIMIT_MAX=5

# 审计日志
AUDIT_ENABLED=true
AUDIT_RETENTION_DAYS=90
```

## 安全中间件

### 使用综合安全中间件

```typescript
import { comprehensiveSecurity } from './utils/security';

// 应用所有安全中间件
app.use(comprehensiveSecurity);
```

### 单独使用中间件

```typescript
import { 
  securityHeaders, 
  inputValidation, 
  csrfProtection 
} from './utils/security';

app.use(securityHeaders);
app.use(inputValidation);
app.use(csrfProtection);
```

## 认证与授权

### JWT Token机制

系统使用双Token机制：
- **Access Token**: 短期有效（15分钟），用于API访问
- **Refresh Token**: 长期有效（7天），用于刷新Access Token

### Token刷新流程

```typescript
// 客户端检测到Access Token过期
const response = await fetch('/api/auth/refresh-token', {
  method: 'POST',
  body: JSON.stringify({
    userId: currentUser.id,
    refreshToken: storedRefreshToken,
  }),
});

const { accessToken, refreshToken } = await response.json();
// 更新存储的Token
```

### 权限控制

```typescript
import { requirePermission, requireRole } from './utils/permission';

// 需要特定权限
router.get('/admin/users', 
  authenticate,
  requirePermission('admin:read'),
  adminController.getUsers
);

// 需要特定角色
router.post('/products',
  authenticate,
  requireRole('merchant', 'admin'),
  productController.create
);

// 资源所有权检查
router.put('/products/:id',
  authenticate,
  requireResourceAccess('product', 'write'),
  productController.update
);
```

## 输入验证

### 使用验证工具

```typescript
import { inputValidator, commonValidationRules } from './utils/security';

// 验证单个字段
const usernameResult = inputValidator.validateField(
  req.body.username,
  commonValidationRules.username,
  'username'
);

if (!usernameResult.isValid) {
  throw new ValidationError(usernameResult.errors.join('; '));
}

// 验证整个对象
const result = inputValidator.validateObject(req.body, {
  username: commonValidationRules.username,
  email: commonValidationRules.email,
  password: commonValidationRules.password,
});
```

### 创建验证中间件

```typescript
const registerValidation = inputValidator.createValidationMiddleware({
  username: commonValidationRules.username,
  email: commonValidationRules.email,
  password: commonValidationRules.password,
});

router.post('/register', registerValidation, authController.register);
```

## 数据加密

### 字段加密

```typescript
import { encryptionManager } from './utils/security';

// 加密敏感数据
const encryptedEmail = encryptionManager.encrypt(user.email);

// 解密数据
const decryptedEmail = encryptionManager.decrypt(encryptedEmail);
```

### 数据脱敏

```typescript
import { encryptionManager } from './utils/security';

// 自动脱敏（根据字段名）
const maskedData = encryptionManager.autoMask({
  username: 'john_doe',
  email: 'john@example.com',
  phone: '13800138000',
  password: 'secret123',
});

// 手动脱敏
const maskedPhone = encryptionManager.maskPhone('13800138000');
const maskedEmail = encryptionManager.maskEmail('john@example.com');
```

### 日志脱敏

```typescript
import { encryptionManager } from './utils/security';

// 日志输出前脱敏
logger.info('User login', encryptionManager.sanitizeForLog({
  username: 'john_doe',
  ip: '192.168.1.100',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
}));
```

## 审计日志

### 记录安全事件

```typescript
import { securityAudit } from './utils/security';

// 记录登录成功
await securityAudit.log('login_success', {
  userId: user.id,
  username: user.username,
  ip: req.ip,
  userAgent: req.get('User-Agent'),
});

// 记录权限拒绝
await securityAudit.log('permission_denied', {
  userId: user.id,
  username: user.username,
  ip: req.ip,
  url: req.url,
  details: { requiredPermission: 'admin:read' },
});
```

### 查询审计日志

```typescript
// 查询最近24小时的登录失败事件
const failures = await securityAudit.query({
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
  event: 'login_failure',
  limit: 100,
});

// 获取统计信息
const stats = await securityAudit.getStatistics();
```

### 异常检测

```typescript
const anomalies = await securityAudit.detectAnomalies();

if (anomalies.suspiciousIps.length > 0) {
  console.log('发现可疑IP:', anomalies.suspiciousIps);
}

if (anomalies.bruteForceAttempts.length > 0) {
  console.log('发现暴力破解尝试:', anomalies.bruteForceAttempts);
}
```

## 部署安全

### 生产环境检查清单

- [ ] 设置强随机JWT密钥
- [ ] 启用HTTPS
- [ ] 配置CORS白名单
- [ ] 启用CSRF防护
- [ ] 启用API签名验证
- [ ] 配置频率限制
- [ ] 启用审计日志
- [ ] 配置日志轮转
- [ ] 设置数据加密密钥
- [ ] 配置数据库连接加密
- [ ] 配置Redis密码
- [ ] 禁用调试模式
- [ ] 配置错误监控
- [ ] 配置安全头

### Nginx安全配置

```nginx
server {
    # 强制HTTPS
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL配置
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'" always;

    # 频率限制
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3001;
    }

    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://localhost:3001;
    }
}

# HTTP重定向到HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Docker安全配置

```dockerfile
# 使用非root用户
FROM node:18-alpine
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

WORKDIR /app
COPY --chown=nodeuser:nodejs . .

USER nodeuser

EXPOSE 3001
CMD ["node", "dist/app.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - DATA_ENCRYPTION_KEY=${DATA_ENCRYPTION_KEY}
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
    read_only: true
    tmpfs:
      - /tmp
```

## 安全检查清单

### 开发阶段

- [ ] 输入验证覆盖所有用户输入
- [ ] SQL查询使用参数化查询
- [ ] 输出编码防止XSS
- [ ] 敏感数据加密存储
- [ ] 日志不包含敏感信息
- [ ] 错误信息不泄露系统细节
- [ ] 实施最小权限原则

### 测试阶段

- [ ] 进行安全代码审查
- [ ] 进行渗透测试
- [ ] 测试频率限制
- [ ] 测试认证绕过
- [ ] 测试授权漏洞
- [ ] 测试注入攻击
- [ ] 测试CSRF攻击

### 部署阶段

- [ ] 启用HTTPS
- [ ] 配置安全头
- [ ] 配置防火墙
- [ ] 配置日志监控
- [ ] 配置告警系统
- [ ] 配置备份策略
- [ ] 配置灾难恢复

### 运维阶段

- [ ] 定期更新依赖
- [ ] 监控安全日志
- [ ] 响应安全事件
- [ ] 定期安全审计
- [ ] 定期备份验证
- [ ] 定期渗透测试

## 常见安全问题处理

### 1. JWT Token泄露

**症状**: 异常登录、未授权访问

**处理**:
1. 立即将Token加入黑名单
2. 强制用户重新登录
3. 检查日志追踪攻击源
4. 通知用户修改密码

### 2. 暴力破解攻击

**症状**: 大量登录失败、账户锁定

**处理**:
1. 检查IP黑名单
2. 调整频率限制
3. 启用验证码
4. 通知受影响用户

### 3. SQL注入攻击

**症状**: 数据库异常、数据泄露

**处理**:
1. 检查并修复漏洞
2. 审计数据库日志
3. 评估数据泄露范围
4. 通知受影响用户

### 4. XSS攻击

**症状**: 用户会话劫持、恶意脚本执行

**处理**:
1. 检查并修复漏洞
2. 清理恶意脚本
3. 通知受影响用户
4. 加强内容安全策略

## 联系方式

如有安全问题，请联系安全团队：
- 邮箱: security@example.com
- 电话: +86 xxx-xxxx-xxxx

---

**最后更新**: 2026年5月25日