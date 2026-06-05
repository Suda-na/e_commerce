import { request } from '../utils/request'

class FavoriteService {
  async toggleFavorite(merchantId: string): Promise<any> {
    const res = await request.post(`/favorites/${merchantId}`)
    return res.data
  }

  async checkFavorite(merchantId: string): Promise<boolean> {
    const res = await request.get(`/favorites/check/${merchantId}`)
    return res.data?.data?.isFavorite || false
  }

  async getFavorites(page?: number, limit?: number): Promise<any> {
    const p = page || 1
    const l = limit || 20
    const res = await request.get('/favorites', { page: p, limit: l })
    return res.data
  }

  async removeFavorite(merchantId: string): Promise<any> {
    const res = await request.delete(`/favorites/${merchantId}`)
    return res.data
  }
}

export const favoriteService = new FavoriteService()
export default favoriteService
