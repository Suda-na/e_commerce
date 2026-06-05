// nav-bar.ts - 自定义导航栏组件
Component({
  options: {
    multipleSlots: true,
  },

  properties: {
    /** 背景透明度（0-1） */
    backgroundAlpha: {
      type: Number,
      value: 0,
    },
  },

  data: {
    statusBarHeight: 20,
    navBarHeight: 44,
  },

  lifetimes: {
    attached() {
      this.initNavBarHeight()
    },
  },

  methods: {
    /** 初始化导航栏高度 */
    initNavBarHeight() {
      try {
        const sysInfo = wx.getSystemInfoSync()
        // 状态栏高度
        const statusBarHeight = sysInfo.statusBarHeight || 20
        // 微信小程序导航栏高度（iOS 44px, Android 48px）
        const navBarHeight = sysInfo.platform === 'ios' ? 44 : 48

        this.setData({
          statusBarHeight,
          navBarHeight,
        })
      } catch (e) {
        console.error('[NavBar] 获取系统信息失败:', e)
      }
    },
  },
})
