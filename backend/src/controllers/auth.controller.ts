import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { authService } from '../services/auth.service';
import { ValidationError, AuthenticationError } from '../middleware/errorHandler';
import { AuthRequest, IUserCreate, IUserLogin } from '../types';
import { logger } from '../utils/logger';
import { successResponse, createdResponse, noDataResponse } from '../utils/response';
import { Bid } from '../models/Bid';
import { Auction } from '../models/Auction';
import { Favorite } from '../models/Favorite';
import { sequelize } from '../config/database';

export const authController = {
  /**
   * 用户注册
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const userData: IUserCreate = {
        username: req.body.username,
        password: req.body.password,
        role: req.body.role || 'user',
      };

      // 调用认证服务注册用户
      const result = await authService.register(userData);

      logger.info(`User registered: ${result.user.username}`);

      createdResponse(res, result, '注册成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 用户登录
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const loginData: IUserLogin = {
        username: req.body.username,
        password: req.body.password,
      };

      // 调用认证服务登录
      const result = await authService.login(loginData);

      logger.info(`User logged in: ${result.user.username}`);

      successResponse(res, result, '登录成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 获取个人信息
   */
  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const user = await authService.getProfile(req.user.userId);

      successResponse(res, user);
    } catch (error) {
      next(error);
    }
  },

  /**
   * 更新个人信息
   */
  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 验证请求参数
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError(errors.array()[0].msg);
      }

      const updateData: any = {};
      
      // 只有当字段存在时才加入更新
      if (req.body.username !== undefined) updateData.username = req.body.username;
      if (req.body.avatar !== undefined) {
        updateData.avatar = req.body.avatar && req.body.avatar.trim() !== '' 
          ? req.body.avatar 
          : null;
      }
      if (req.body.email !== undefined) updateData.email = req.body.email || null;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone || null;
      // 收货地址字段
      if (req.body.receiver_name !== undefined) updateData.receiver_name = req.body.receiver_name || null;
      if (req.body.receiver_phone !== undefined) updateData.receiver_phone = req.body.receiver_phone || null;
      if (req.body.province !== undefined) updateData.province = req.body.province || null;
      if (req.body.city !== undefined) updateData.city = req.body.city || null;
      if (req.body.district !== undefined) updateData.district = req.body.district || null;
      if (req.body.detail_address !== undefined) updateData.detail_address = req.body.detail_address || null;

      const user = await authService.updateProfile(req.user.userId, updateData);

      logger.info(`User profile updated: ${user.username}`);

      successResponse(res, user, '个人信息更新成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 刷新Token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, refreshToken } = req.body;

      if (!userId || !refreshToken) {
        throw new ValidationError('缺少必要的参数');
      }

      const result = await authService.refreshToken(userId, refreshToken);

      successResponse(res, result, 'Token刷新成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 退出登录
   */
  async logout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      // 从请求头获取Token用于黑名单
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        await authService.logout(req.user.userId, token);
      }

      logger.info(`User logged out: ${req.user.username}`);

      noDataResponse(res, '退出登录成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 上传用户头像
   */
  async uploadAvatar(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        throw new ValidationError('请选择要上传的头像图片');
      }

      // 验证文件内容
      const { validateFileBuffer, generateSafeFilename } = await import('../middleware/upload');
      const bufferValidation = validateFileBuffer(file);
      if (!bufferValidation.valid) {
        throw new ValidationError(bufferValidation.error || '文件验证失败');
      }

      // 上传到 BoltP 图床
      const axios = (await import('axios')).default;
      const FormData = (await import('form-data')).default;
      const safeFilename = generateSafeFilename(file.originalname);

      const BOLTP_API_URL = process.env.BOLTP_API_URL || 'https://www.boltp.com/api/v2/upload';
      const BOLTP_STORAGE_ID = parseInt(process.env.BOLTP_STORAGE_ID || '2', 10);
      const BOLTP_API_TOKEN = process.env.BOLTP_API_TOKEN || '';

      const formData = new FormData();
      formData.append('file', file.buffer, {
        filename: safeFilename,
        contentType: file.mimetype,
      });
      formData.append('storage_id', BOLTP_STORAGE_ID.toString());
      formData.append('is_public_permanent', 'true');

      const response = await axios.post(BOLTP_API_URL, formData, {
        headers: {
          Accept: 'application/json',
          ...(BOLTP_API_TOKEN ? { Authorization: `Bearer ${BOLTP_API_TOKEN}` } : {}),
          ...formData.getHeaders(),
        },
        timeout: 30000,
      });

      if (response.data?.status !== 'success' || !response.data?.data?.public_url) {
        throw new ValidationError(response.data?.message || '头像上传失败');
      }

      const avatarUrl = response.data.data.public_url;

      // 更新用户头像
      const user = await authService.updateProfile(req.user.userId, { avatar: avatarUrl });

      logger.info(`User avatar uploaded: ${user.username}`);

      successResponse(res, { url: avatarUrl, user }, '头像上传成功');
    } catch (error) {
      next(error);
    }
  },

  /**
   * 头像代理：通过后端转发外部头像图片，解决小程序白名单限制
   * GET /api/auth/avatar-proxy?url=xxx
   */
  async avatarProxy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        res.status(400).json({ success: false, message: '缺少 url 参数' });
        return;
      }

      // 只允许代理头像相关域名
      const allowedHosts = [
        'api.dicebear.com',
        'cdn.boltp.com',
        'boltp.com',
        'www.boltp.com',
      ];
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        res.status(400).json({ success: false, message: '无效的 URL' });
        return;
      }

      if (!allowedHosts.some(host => parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host))) {
        res.status(403).json({ success: false, message: '不允许代理该域名' });
        return;
      }

      const axios = (await import('axios')).default;
      const response = await axios.get(targetUrl, {
        responseType: 'arraybuffer',
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      const contentType = String(response.headers['content-type'] || 'image/png');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(response.data);
    } catch (error: any) {
      logger.error(`Avatar proxy error: ${error.message}`);
      // 代理失败时返回默认头像重定向
      res.redirect('/assets/icons/default-avatar.png');
    }
  },

  /**
   * 获取所有商家用户
   */
  async getMerchants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const merchants = await authService.getMerchants();

      successResponse(res, merchants);
    } catch (error) {
      next(error);
    }
  },

  async getUserStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AuthenticationError('未认证');
      }

      const userId = req.user.userId;
      logger.info(`[getUserStats] 查询用户统计, userId: ${userId}, type: ${typeof userId}`);

      // 先刷新所有Redis队列中的出价到数据库，确保统计准确
      try {
        const { bidService } = await import('../services/bid.service');
        await bidService.flushAllBidQueues();
        logger.info('[getUserStats] Redis出价队列已刷新到数据库');
      } catch (flushError) {
        logger.warn('[getUserStats] 刷新Redis队列失败，继续查询:', flushError);
      }

      // 查询出价次数
      const bidCount = await Bid.count({ where: { user_id: userId } });
      logger.info(`[getUserStats] bidCount: ${bidCount}`);

      // 查询参与竞拍次数（不同的auction_id数量）
      const auctionCountResult = await Bid.findAll({
        where: { user_id: userId },
        attributes: [[sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('auction_id'))), 'count']],
        raw: true,
      });
      const auctionCount = parseInt((auctionCountResult[0] as any)?.count || '0');
      logger.info(`[getUserStats] auctionCount: ${auctionCount}, raw result: ${JSON.stringify(auctionCountResult)}`);

      // 查询中标次数
      const winCount = await Auction.count({ where: { winner_id: userId, status: 'completed' } });
      logger.info(`[getUserStats] winCount: ${winCount}`);

      // 查询收藏商家数
      const favoriteCount = await Favorite.count({ where: { user_id: userId } });
      logger.info(`[getUserStats] favoriteCount: ${favoriteCount}`);

      // 额外检查：查询bids表中是否有该用户的数据
      const sampleBids = await Bid.findAll({
        where: { user_id: userId },
        limit: 5,
        attributes: ['id', 'auction_id', 'user_id', 'amount', 'created_at'],
        raw: true,
      });
      logger.info(`[getUserStats] 用户 ${userId} 的出价样本: ${JSON.stringify(sampleBids)}`);

      // 检查bids表总数
      const totalBidsInDb = await Bid.count();
      logger.info(`[getUserStats] bids表总记录数: ${totalBidsInDb}`);

      const stats = {
        auctionCount,
        bidCount,
        winCount,
        favoriteCount,
      };
      logger.info(`[getUserStats] 最终统计: ${JSON.stringify(stats)}`);

      successResponse(res, stats);
    } catch (error) {
      logger.error('[getUserStats] 查询失败:', error);
      next(error);
    }
  },
};

export default authController;