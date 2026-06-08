import { favoriteService } from '../../services/favorite.service'
import { proxyAvatarUrl } from '../../utils/util'

interface MerchantFavorite {
  id: number
  merchantId: number
  merchantName: string
  merchantAvatar: string
  createdAt: string
}

Page({
  data: {
    favorites: [] as MerchantFavorite[],
    loading: false,
    isEmpty: false,
    isEditing: false,
    selectedIds: [] as number[],
    selectAll: false,
    page: 1,
    totalPages: 1,
    total: 0,
  },

  onLoad() {
    this.loadFavorites()
  },

  onShow() {
    this.loadFavorites()
  },

  async loadFavorites() {
    this.setData({ loading: true })

    try {
      const result = await favoriteService.getFavorites(1, 50)
      const data = result?.data || result
      const favorites = (data?.favorites || []).map((f: any) => ({
        ...f,
        merchantAvatar: proxyAvatarUrl(f.merchantAvatar || f.merchant_avatar || ''),
      }))

      this.setData({
        favorites,
        isEmpty: favorites.length === 0,
        loading: false,
        total: data?.total || 0,
        totalPages: data?.totalPages || 1,
        page: 1,
      })
    } catch (err) {
      console.error('加载收藏列表失败:', err)
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onPullDownRefresh() {
    this.loadFavorites()
    wx.stopPullDownRefresh()
  },

  onTapItem(e: WechatMiniprogram.TouchEvent) {
    const { id } = e.currentTarget.dataset

    if (this.data.isEditing) {
      this.toggleSelect(id)
      return
    }

    const item = this.data.favorites.find((f: MerchantFavorite) => f.id === id)
    if (item) {
      wx.navigateTo({
        url: `/pages/live/live-room?merchantId=${item.merchantId}`,
      })
    }
  },

  toggleEditMode() {
    this.setData({
      isEditing: !this.data.isEditing,
      selectedIds: [],
      selectAll: false,
    })
  },

  toggleSelect(id: number) {
    const { selectedIds } = this.data
    const index = selectedIds.indexOf(id)

    if (index > -1) {
      selectedIds.splice(index, 1)
    } else {
      selectedIds.push(id)
    }

    this.setData({
      selectedIds,
      selectAll: selectedIds.length === this.data.favorites.length,
    })
  },

  toggleSelectAll() {
    const { favorites, selectAll } = this.data

    if (selectAll) {
      this.setData({ selectedIds: [], selectAll: false })
    } else {
      this.setData({
        selectedIds: favorites.map((item: MerchantFavorite) => item.id),
        selectAll: true,
      })
    }
  },

  async deleteSelected() {
    const { selectedIds, favorites } = this.data

    if (selectedIds.length === 0) {
      wx.showToast({ title: '请选择要删除的商家', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要取消收藏选中的 ${selectedIds.length} 个商家吗？`,
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          const toDelete = favorites.filter((f: MerchantFavorite) =>
            selectedIds.includes(f.id)
          )

          for (const item of toDelete) {
            try {
              await favoriteService.removeFavorite(String(item.merchantId))
            } catch (err) {
              console.error('取消收藏失败:', err)
            }
          }

          this.loadFavorites()
          wx.showToast({ title: '已取消收藏', icon: 'success' })
        }
      },
    })
  },

  async deleteItem(e: WechatMiniprogram.TouchEvent) {
    const { merchantid } = e.currentTarget.dataset

    wx.showModal({
      title: '确认删除',
      content: '确定要取消收藏这个商家吗？',
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            await favoriteService.removeFavorite(String(merchantid))
            this.loadFavorites()
            wx.showToast({ title: '已取消收藏', icon: 'success' })
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      },
    })
  },

  async clearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有收藏吗？此操作不可恢复。',
      confirmText: '清空',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          const { favorites } = this.data
          for (const item of favorites) {
            try {
              await favoriteService.removeFavorite(String(item.merchantId))
            } catch (err) {
              console.error('取消收藏失败:', err)
            }
          }
          this.setData({
            favorites: [],
            isEmpty: true,
            isEditing: false,
            selectedIds: [],
            selectAll: false,
          })
          wx.showToast({ title: '已清空收藏', icon: 'success' })
        }
      },
    })
  },

  goToDiscover() {
    wx.switchTab({ url: '/pages/discover/index' })
  },

  formatTime(time: string): string {
    if (!time) return ''
    const date = new Date(time)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`

    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${month}-${day}`
  },

  onShareAppMessage() {
    return {
      title: '我的收藏 - 直播竞拍大师',
      path: '/pages/profile/favorites',
    }
  },
})
