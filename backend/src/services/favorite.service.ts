import { Favorite } from '../models/Favorite';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { Op } from 'sequelize';

export class FavoriteService {
  async addFavorite(userId: number, merchantId: number): Promise<{ isFavorite: boolean }> {
    const merchant = await User.findByPk(merchantId);
    if (!merchant) {
      throw new Error('商家不存在');
    }
    if (merchant.role !== 'merchant') {
      throw new Error('该用户不是商家');
    }

    const [favorite, created] = await Favorite.findOrCreate({
      where: { user_id: userId, merchant_id: merchantId },
      defaults: { user_id: userId, merchant_id: merchantId },
    });

    if (!created) {
      await favorite.destroy();
      return { isFavorite: false };
    }

    return { isFavorite: true };
  }

  async removeFavorite(userId: number, merchantId: number): Promise<boolean> {
    const deleted = await Favorite.destroy({
      where: { user_id: userId, merchant_id: merchantId },
    });
    return deleted > 0;
  }

  async checkFavorite(userId: number, merchantId: number): Promise<boolean> {
    const count = await Favorite.count({
      where: { user_id: userId, merchant_id: merchantId },
    });
    return count > 0;
  }

  async getFavorites(userId: number, query: { page?: number; limit?: number }): Promise<{
    favorites: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Favorite.findAndCountAll({
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: 'merchant',
          attributes: ['id', 'username', 'avatar', 'role'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true,
    });

    return {
      favorites: rows.map((row: any) => ({
        id: row.id,
        merchantId: row.merchant_id,
        merchantName: row.merchant?.username || '',
        merchantAvatar: row.merchant?.avatar || '',
        createdAt: row.created_at,
      })),
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
    };
  }

  async getFavoriteCount(userId: number): Promise<number> {
    return Favorite.count({
      where: { user_id: userId },
    });
  }

  async getFavoriteMerchantIds(userId: number): Promise<number[]> {
    const favorites = await Favorite.findAll({
      where: { user_id: userId },
      attributes: ['merchant_id'],
      raw: true,
    });
    return favorites.map((f: any) => f.merchant_id);
  }
}

export const favoriteService = new FavoriteService();
