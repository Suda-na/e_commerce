/**
 * 安全功能使用示例
 * 展示如何在实际项目中使用安全工具
 */

import express from 'express';
import { 
  security,
  securityConfig,
  securityAudit,
  inputValidator,
  commonValidationRules,
  encryptionManager,
  requirePermission,
  requireRole,
  requireResourceAccess,
} from '../utils/security';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = express.Router();

// ==================== 1. 初始化安全系统 ====================

/**
 * 在应用启动时初始化安全系统
 */
async function initializeSecurity() {
  try {
    await security.initialize();
    console.log('安全系统初始化完成');
    
    // 运行安全检查
    const checkResult = await security.runSecurityCheck();
    if (!checkResult.passed) {
      console.warn('安全检查发现问题:', checkResult.issues);
      console.warn('建议:', checkResult.recommendations);
    }
  } catch (error) {
    console.error('安全系统初始化失败:', error);
    process.exit(1);
  }
}

// ==================== 2. 认证与授权示例 ====================

/**
 * 用户注册 - 使用输入验证
 */
router.post('/register', async (req, res, next) => {
  try {
    const validationResult = inputValidator.validateObject(req.body, {
      username: commonValidationRules.username,
      email: commonValidationRules.email,
      password: commonValidationRules.password,
    });

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        errors: validationResult.errors,
      });
    }

    const passwordValidation = inputValidator.validatePassword(req.body.password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        errors: passwordValidation.errors,
      });
    }

    const sanitizedData = validationResult.sanitizedValue;

    await securityAudit.log('data_modification', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: { action: 'user_registration' },
    });

    res.json({ success: true, message: '注册成功' });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

/**
 * 用户登录 - 使用频率限制和审计
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空',
      });
    }

    await securityAudit.log('login_success', {
      username,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({
      success: true,
      data: {
        accessToken: '...',
        refreshToken: '...',
      },
    });
    return;
  } catch (error: unknown) {
    const err = error as Error;
    await securityAudit.log('login_failure', {
      username: req.body.username,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      details: { reason: err.message },
    });

    next(error);
    return;
  }
});

/**
 * 刷新Token
 */
router.post('/refresh-token', async (req, res, next) => {
  try {
    const { userId, refreshToken } = req.body;

    if (!userId || !refreshToken) {
      return res.status(400).json({
        success: false,
        message: '缺少必要的参数',
      });
    }

    const result = await security.jwt.refreshTokenPair(userId, refreshToken);
    if (!result) {
      return res.status(401).json({
        success: false,
        message: 'Refresh Token无效或已过期',
      });
    }

    res.json({
      success: true,
      data: result,
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// ==================== 3. 权限控制示例 ====================

/**
 * 获取用户列表 - 需要管理员权限
 */
router.get('/admin/users',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res, next) => {
    try {
      // 只有管理员可以访问
      const users: unknown[] = [];
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 创建商品 - 需要商家或管理员权限
 */
router.post('/products',
  authenticate,
  requireRole('merchant', 'admin'),
  async (req: AuthRequest, res, next) => {
    try {
      // 商家或管理员可以创建商品
      const product = {}; // 创建商品
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 更新商品 - 需要商品写入权限和资源所有权
 */
router.put('/products/:id',
  authenticate,
  requirePermission('product:write'),
  requireResourceAccess('product', 'write'),
  async (req: AuthRequest, res, next) => {
    try {
      // 检查权限和资源所有权
      const productId = parseInt(req.params.id, 10);
      const product = {}; // 更新商品
      res.json({ success: true, data: product });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 删除商品 - 需要商品删除权限
 */
router.delete('/products/:id',
  authenticate,
  requirePermission('product:delete'),
  requireResourceAccess('product', 'delete'),
  async (req: AuthRequest, res, next) => {
    try {
      const productId = parseInt(req.params.id, 10);
      // 删除商品
      res.json({ success: true, message: '商品删除成功' });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== 4. 数据加密示例 ====================

/**
 * 保存敏感数据 - 使用字段加密
 */
router.post('/sensitive-data',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { email, phone, idCard } = req.body;

      // 加密敏感字段
      const encryptedData = encryptionManager.encryptObjectFields(
        { email, phone, idCard },
        ['email', 'phone', 'idCard']
      );

      // 保存到数据库
      // await saveToDatabase(encryptedData);

      res.json({ success: true, message: '数据保存成功' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 读取敏感数据 - 使用字段解密
 */
router.get('/sensitive-data/:id',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const id = parseInt(req.params.id, 10);

      // 从数据库读取加密数据
      const encryptedData = {
        email: 'encrypted_email',
        phone: 'encrypted_phone',
        idCard: 'encrypted_idCard',
      };

      // 解密敏感字段
      const decryptedData = encryptionManager.decryptObjectFields(
        encryptedData,
        ['email', 'phone', 'idCard']
      );

      // 返回脱敏后的数据
      const maskedData = encryptionManager.autoMask(decryptedData);

      res.json({ success: true, data: maskedData });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== 5. 审计日志示例 ====================

/**
 * 查询审计日志 - 需要管理员权限
 */
router.get('/admin/audit-logs',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res, next) => {
    try {
      const { startTime, endTime, event, level, limit } = req.query;

      const queryOptions = {
        startTime: startTime ? new Date(startTime as string) : undefined,
        endTime: endTime ? new Date(endTime as string) : undefined,
        event: event as any,
        level: level as any,
        limit: limit ? parseInt(limit as string, 10) : 100,
      };

      const logs = await securityAudit.query(queryOptions);
      res.json({ success: true, data: logs });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 获取安全统计 - 需要管理员权限
 */
router.get('/admin/security-stats',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res, next) => {
    try {
      const statistics = await securityAudit.getStatistics();
      const anomalies = await securityAudit.detectAnomalies();

      res.json({
        success: true,
        data: {
          statistics,
          anomalies,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 生成安全报告 - 需要管理员权限
 */
router.get('/admin/security-report',
  authenticate,
  requireRole('admin'),
  async (req: AuthRequest, res, next) => {
    try {
      const report = await security.generateSecurityReport();
      res.json({ success: true, data: { report } });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== 6. 输入验证示例 ====================

/**
 * 验证复杂输入
 */
router.post('/complex-input',
  async (req, res, next) => {
    try {
      const arrayValidation = inputValidator.validateArray(req.body.items, {
        minLength: 1,
        maxLength: 10,
        itemValidator: (item) => {
          return inputValidator.validateObject(item, {
            name: { required: true, type: 'string', minLength: 1, maxLength: 100 },
            quantity: { required: true, type: 'number', min: 1, max: 1000 },
            price: { required: true, type: 'number', min: 0.01 },
          });
        },
      });

      if (!arrayValidation.isValid) {
        return res.status(400).json({
          success: false,
          errors: arrayValidation.errors,
        });
      }

      const dateValidation = inputValidator.validateDate(req.body.startDate, {
        futureOnly: true,
      });

      if (!dateValidation.isValid) {
        return res.status(400).json({
          success: false,
          errors: dateValidation.errors,
        });
      }

      res.json({ success: true, message: '输入验证通过' });
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

/**
 * 文件上传验证
 */
router.post('/upload',
  async (req, res, next) => {
    try {
      const file = (req as any).file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: '请选择要上传的文件',
        });
      }

      const fileValidation = inputValidator.validateFile(file, {
        maxSize: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
        allowedExtensions: ['jpg', 'jpeg', 'png', 'gif'],
      });

      if (!fileValidation.isValid) {
        return res.status(400).json({
          success: false,
          errors: fileValidation.errors,
        });
      }

      await securityAudit.log('file_upload', {
        userId: (req as AuthRequest).user?.userId,
        ip: req.ip,
        details: {
          filename: file.originalname,
          size: file.size,
          type: file.mimetype,
        },
      });

      res.json({ success: true, message: '文件上传成功' });
      return;
    } catch (error) {
      next(error);
      return;
    }
  }
);

// ==================== 7. 安全头配置示例 ====================

/**
 * 自定义安全头
 */
router.get('/custom-headers',
  (req, res) => {
    // 设置自定义安全头
    res.setHeader('X-Custom-Header', 'secure-value');
    res.setHeader('X-Request-ID', req.security?.requestId || 'unknown');
    
    res.json({ success: true, message: '自定义安全头已设置' });
  }
);

// ==================== 8. 错误处理示例 ====================

/**
 * 安全错误处理
 */
router.get('/protected-resource',
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.user) {
        throw new Error('未认证');
      }

      await securityAudit.log('data_access', {
        userId: req.user.userId,
        username: req.user.username,
        ip: req.ip,
        url: req.url,
        method: req.method,
      });

      res.json({ success: true, data: { message: '受保护的资源' } });
      return;
    } catch (error: unknown) {
      const err = error as Error;
      await securityAudit.log('api_error', {
        userId: req.user?.userId,
        ip: req.ip,
        url: req.url,
        method: req.method,
        details: { error: err.message },
      });

      next(error);
      return;
    }
  }
);

export default router;

/**
 * 使用示例总结：
 * 
 * 1. 初始化：在应用启动时调用 security.initialize()
 * 2. 认证：使用 authenticate 中间件验证JWT Token
 * 3. 授权：使用 requireRole、requirePermission、requireResourceAccess 中间件
 * 4. 输入验证：使用 inputValidator 验证和清理输入数据
 * 5. 数据加密：使用 encryptionManager 加密敏感数据
 * 6. 审计日志：使用 securityAudit.log() 记录安全事件
 * 7. 安全检查：使用 security.runSecurityCheck() 检查安全配置
 * 8. 安全报告：使用 security.generateSecurityReport() 生成安全报告
 */