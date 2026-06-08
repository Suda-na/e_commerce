import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { csrfProtection, distributedRateLimit } from '../middleware/security.middleware';
import { securityConfig } from '../config/security.config';
import { uploadImages } from '../middleware/upload';

const router = Router();

// 验证规则
const registerValidation = [
  body('username')
    .isLength({ min: 5, max: 50 })
    .withMessage('用户名长度必须在5-50个字符之间')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  body('password')
    .isLength({ min: 6, max: 20 })
    .withMessage('密码长度必须在6-20个字符之间')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('密码必须包含至少一个字母和一个数字'),
  body('role')
    .optional()
    .isIn(['user', 'merchant'])
    .withMessage('角色必须是user或merchant'),
];

const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 5, max: 50 })
    .withMessage('用户名长度必须在5-50个字符之间'),
  body('password')
    .notEmpty()
    .withMessage('密码不能为空'),
];

const updateProfileValidation = [
  body('username')
    .optional()
    .isLength({ min: 2, max: 20 })
    .withMessage('昵称长度必须在2-20个字符之间')
    .matches(/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/)
    .withMessage('昵称只能包含中文、英文、数字和下划线'),
  body('avatar')
    .optional({ values: 'falsy' })
    .custom((value) => {
      // 允许空字符串或有效URL
      if (value === '' || value === null || value === undefined) {
        return true;
      }
      // 验证是否为有效URL
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    })
    .withMessage('头像必须是有效的URL'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('请输入正确的邮箱地址'),
  body('phone')
    .optional({ values: 'falsy' })
    .matches(/^1[3-9]\d{9}$/)
    .withMessage('请输入正确的手机号'),
];

// 路由定义

// 注册接口限流（20分钟最多5次）
const registerRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.register.windowMs,
  max: securityConfig.apiSecurity.rateLimit.register.max,
  keyGenerator: (req) => `rate:register:${req.ip}`,
  message: '注册请求过于频繁，请稍后再试', // 实际返回的消息会包含剩余时间
});

// 登录接口限流（15分钟最多5次）
const loginRateLimit = distributedRateLimit({
  windowMs: securityConfig.apiSecurity.rateLimit.login.windowMs,
  max: securityConfig.apiSecurity.rateLimit.login.max,
  keyGenerator: (req) => `rate:login:${req.ip}`,
  message: '登录请求过于频繁，请稍后再试',
});

// Token刷新限流（每分钟最多10次）
const refreshTokenRateLimit = distributedRateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => `rate:refresh:${req.ip}`,
  message: 'Token刷新请求过于频繁，请稍后再试',
});

/**
 * @route POST /api/auth/register
 * @desc 用户注册
 * @access Public
 */
router.post('/register',
  registerRateLimit,
  registerValidation,
  asyncHandler(authController.register)
);

/**
 * @route POST /api/auth/login
 * @desc 用户登录
 * @access Public
 */
router.post('/login',
  loginRateLimit,
  loginValidation,
  asyncHandler(authController.login)
);

/**
 * @route GET /api/auth/profile
 * @desc 获取个人信息
 * @access Private
 */
router.get('/profile',
  authenticate,
  asyncHandler(authController.getProfile)
);

/**
 * @route PUT /api/auth/profile
 * @desc 更新个人信息
 * @access Private (需CSRF验证)
 */
router.put('/profile',
  authenticate,
  csrfProtection,
  updateProfileValidation,
  asyncHandler(authController.updateProfile)
);

/**
 * @route POST /api/auth/refresh-token
 * @desc 刷新Token
 * @access Public
 */
router.post('/refresh-token',
  refreshTokenRateLimit,
  [
    body('userId')
      .isInt({ min: 1 })
      .withMessage('用户ID必须是正整数'),
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh Token不能为空'),
  ],
  asyncHandler(authController.refreshToken)
);

/**
 * @route POST /api/auth/logout
 * @desc 退出登录
 * @access Private (需CSRF验证)
 */
router.post('/logout',
  authenticate,
  csrfProtection,
  asyncHandler(authController.logout)
);

/**
 * @route POST /api/auth/avatar
 * @desc 上传用户头像
 * @access Private
 */
router.post('/avatar',
  authenticate,
  uploadImages.single('avatar'),
  asyncHandler(authController.uploadAvatar)
);

/**
 * @route GET /api/auth/avatar-proxy
 * @desc 头像代理（解决小程序白名单限制）
 * @access Public
 */
router.get('/avatar-proxy',
  asyncHandler(authController.avatarProxy)
);

/**
 * @route GET /api/auth/merchants
 * @desc 获取所有商家用户
 * @access Public
 */
router.get('/merchants',
  asyncHandler(authController.getMerchants)
);

router.get('/stats',
  authenticate,
  asyncHandler(authController.getUserStats)
);

export default router;