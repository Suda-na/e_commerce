/**
 * 关于我们页面逻辑
 * 纯前端静态页面，使用模拟硬编码数据
 */

Page({
  data: {
    // 应用信息
    appInfo: {
      name: '直播竞拍大师',
      version: '1.0.0',
      build: '2026.06.01',
      logo: '🎯',
    },

    // 公司简介
    companyIntro: {
      title: '关于我们',
      content: '直播竞拍大师是一家专注于直播电商与实时竞拍的创新科技公司。我们致力于为用户提供安全、公平、有趣的在线竞拍体验，让每一次出价都充满期待。自2024年成立以来，我们已服务超过100万用户，累计成交金额突破10亿元。',
      founded: '2024年',
      users: '100万+',
      transactions: '10亿+',
    },

    // 核心价值观
    coreValues: [
      {
        id: '1',
        icon: '🔒',
        title: '安全可靠',
        desc: '采用银行级加密技术，保障每一笔交易安全',
      },
      {
        id: '2',
        icon: '⚖️',
        title: '公平公正',
        desc: '智能竞价系统，确保每位用户公平参与',
      },
      {
        id: '3',
        icon: '🚀',
        title: '创新体验',
        desc: '直播+竞拍的创新模式，带来沉浸式购物体验',
      },
      {
        id: '4',
        icon: '💯',
        title: '品质保证',
        desc: '严格筛选入驻商家，确保商品品质',
      },
    ],

    // 团队介绍
    teamInfo: {
      title: '我们的团队',
      desc: '由来自互联网、电商、金融等领域的精英组成，拥有丰富的行业经验和技术实力。',
      members: [
        { role: '技术团队', count: '50+', icon: '💻' },
        { role: '运营团队', count: '30+', icon: '📊' },
        { role: '客服团队', count: '100+', icon: '🎧' },
      ],
    },

    // 联系方式
    contactInfo: {
      address: '广东省深圳市南山区科技园创新大厦A座20层',
      email: 'contact@auction.com',
      phone: '400-888-9999',
      workHours: '周一至周日 9:00-21:00',
    },

    // 社交媒体
    socialMedia: [
      { id: 'wechat', icon: '💬', name: '微信公众号', account: '直播竞拍大师' },
      { id: 'weibo', icon: '📱', name: '微博', account: '@直播竞拍大师' },
      { id: 'douyin', icon: '🎵', name: '抖音', account: '直播竞拍大师' },
    ],

    // 资质信息
    qualifications: [
      '营业执照编号：91440300XXXXXXXXXX',
      'ICP备案号：粤ICP备XXXXXXXX号',
      '网络文化经营许可证：粤网文[2024]XXXX-XXX号',
      '增值电信业务经营许可证：粤B2-2024XXXX',
    ],

    // 法律链接
    legalLinks: [
      { id: 'agreement', title: '用户协议', icon: '📄' },
      { id: 'privacy', title: '隐私政策', icon: '🔐' },
      { id: 'terms', title: '服务条款', icon: '📋' },
      { id: 'copyright', title: '版权声明', icon: '©️' },
    ],
  },

  onLoad() {
    console.log('关于我们页面加载')
  },

  /**
   * 复制联系方式
   */
  onCopyContact(e: any) {
    const { type } = e.currentTarget.dataset
    const { contactInfo } = this.data
    let text = ''

    switch (type) {
      case 'address':
        text = contactInfo.address
        break
      case 'email':
        text = contactInfo.email
        break
      case 'phone':
        text = contactInfo.phone
        break
      default:
        return
    }

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success',
        })
      },
    })
  },

  /**
   * 拨打电话
   */
  onCallPhone() {
    wx.makePhoneCall({
      phoneNumber: this.data.contactInfo.phone,
      fail: () => {
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none',
        })
      },
    })
  },

  /**
   * 查看法律文档
   */
  onLegalLinkTap(e: any) {
    const { id } = e.currentTarget.dataset
    wx.showToast({
      title: '页面开发中',
      icon: 'none',
    })
  },

  /**
   * 复制社交媒体账号
   */
  onCopySocial(e: any) {
    const { account } = e.currentTarget.dataset
    wx.setClipboardData({
      data: account,
      success: () => {
        wx.showToast({
          title: '账号已复制',
          icon: 'success',
        })
      },
    })
  },

  /**
   * 检查更新
   */
  onCheckUpdate() {
    wx.showLoading({
      title: '检查中...',
    })

    setTimeout(() => {
      wx.hideLoading()
      wx.showModal({
        title: '检查更新',
        content: '当前已是最新版本 v1.0.0',
        showCancel: false,
      })
    }, 1500)
  },

  /**
   * 给我们评分
   */
  onRateUs() {
    wx.showToast({
      title: '感谢您的支持！',
      icon: 'success',
    })
  },
})