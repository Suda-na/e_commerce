import { Request, Response, NextFunction } from 'express';
import { pageViewService } from '../services/page-view.service';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// 扩展Request接口
declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

/**
 * 页面浏览记录中间件
 * 自动记录商品、竞拍、直播页面的浏览数据
 */
export const pageViewMiddleware = (pageType: 'product' | 'auction' | 'live') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 只记录GET请求
      if (req.method !== 'GET') {
        return next();
      }

      // 获取或生成会话ID
      let sessionId = req.cookies?.sessionId || req.headers['x-session-id'] as string;
      if (!sessionId) {
        sessionId = uuidv4();
        // 设置cookie，有效期30天
        res.cookie('sessionId', sessionId, {
          maxAge: 30 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
        });
      }

      // 获取商品ID（从路由参数）
      const productId = parseInt(req.params.id || req.params.productId);
      if (isNaN(productId)) {
        return next();
      }

      // 获取用户ID（如果已登录）
      const userId = (req as any).user?.userId;

      // 获取客户端信息
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const referrer = (req.headers.referer || req.headers.referrer || null) as string | null;

      // 异步记录浏览（不阻塞请求）
      setImmediate(async () => {
        await pageViewService.recordView({
          product_id: productId,
          user_id: userId,
          session_id: sessionId,
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer || undefined,
          page_type: pageType,
        });
      });

      next();
    } catch (error) {
      // 浏览记录失败不应影响正常请求
      logger.error('Page view middleware error:', error);
      next();
    }
  };
};

/**
 * 商品详情页面浏览中间件
 */
export const productViewMiddleware = pageViewMiddleware('product');

/**
 * 竞拍详情页面浏览中间件
 */
export const auctionViewMiddleware = pageViewMiddleware('auction');

/**
 * 直播间页面浏览中间件
 */
export const liveViewMiddleware = pageViewMiddleware('live');