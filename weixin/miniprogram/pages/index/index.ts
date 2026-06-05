// index.ts
// 启动页面 - 检查登录状态并重定向

const app = getApp<IAppOption>()

Page({
  data: {
    loading: true,
    statusText: '正在加载...'
  },

  onLoad() {
    this.checkLoginAndRedirect()
  },

  // 检查登录状态并重定向
  checkLoginAndRedirect() {
    this.setData({ statusText: '检查登录状态...' })
    
    // 延迟模拟检查过程
    setTimeout(() => {
      if (app.globalData.isLoggedIn) {
        this.setData({ statusText: '登录成功，正在跳转...' })
        // 已登录，跳转到首页（发现页面）
        wx.switchTab({
          url: '/pages/discover/index'
        })
      } else {
        this.setData({ statusText: '未登录，正在跳转到登录页...' })
        // 未登录，跳转到登录页
        wx.redirectTo({
          url: '/pages/login/login'
        })
      }
    }, 1000)
  },

  // 手动重试
  onRetry() {
    this.setData({ loading: true })
    this.checkLoginAndRedirect()
  }
})