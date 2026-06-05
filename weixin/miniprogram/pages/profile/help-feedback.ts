/**
 * 帮助与反馈页面逻辑
 * 纯前端静态页面，使用模拟硬编码数据
 */

Page({
  data: {
    // FAQ数据
    faqList: [
      {
        id: '1',
        question: '如何参与直播竞拍？',
        answer: '在"发现"页面浏览直播间，点击进入感兴趣的直播间后，在竞拍商品卡片上点击"出价"按钮即可参与竞拍。首次参与需要完成注册和登录。',
        expanded: false,
      },
      {
        id: '2',
        question: '出价规则是什么？',
        answer: '每次出价必须高于当前最高价，加价幅度由系统设定（通常为当前价格的5%-10%）。竞拍结束前30秒如有新出价，将自动延时30秒，最多延时3次。',
        expanded: false,
      },
      {
        id: '3',
        question: '如何支付中标商品？',
        answer: '中标后会收到通知，在"我的订单"页面可以查看待付款订单。点击"立即支付"完成付款，支持微信支付。请在24小时内完成支付，超时订单将自动取消。',
        expanded: false,
      },
      {
        id: '4',
        question: '可以取消出价吗？',
        answer: '出价成功后无法取消。请在出价前确认金额，谨慎操作。如有特殊情况，请联系客服处理。',
        expanded: false,
      },
      {
        id: '5',
        question: '商品如何发货？',
        answer: '支付完成后，商家会在1-3个工作日内发货。您可以在订单详情中查看物流信息。如有发货问题，请联系商家或平台客服。',
        expanded: false,
      },
      {
        id: '6',
        question: '如何申请退款？',
        answer: '未发货的订单可在订单详情页申请退款。已发货的订单需收到商品后申请售后退款。退款将在1-5个工作日内原路返回。',
        expanded: false,
      },
      {
        id: '7',
        question: '竞拍封顶价是什么？',
        answer: '部分商品设有封顶价，出价达到封顶价后将不再接受更高的出价。达到封顶价的出价者将直接中标。',
        expanded: false,
      },
    ],

    // 联系方式
    contactMethods: [
      {
        id: 'online',
        icon: '💬',
        title: '在线客服',
        desc: '7x24小时在线',
        action: 'online',
      },
      {
        id: 'phone',
        icon: '📞',
        title: '客服电话',
        desc: '400-888-9999',
        action: 'phone',
      },
      {
        id: 'email',
        icon: '📧',
        title: '邮箱反馈',
        desc: 'support@auction.com',
        action: 'email',
      },
    ],

    // 反馈表单
    feedbackForm: {
      typeIndex: 0,
      types: ['功能建议', 'Bug反馈', '体验问题', '内容问题', '其他'],
      content: '',
      contact: '',
    },

    // 表单状态
    submitting: false,
    submitted: false,
  },

  onLoad() {
    console.log('帮助与反馈页面加载')
  },

  /**
   * 展开/折叠FAQ
   */
  onToggleFAQ(e: any) {
    const { id } = e.currentTarget.dataset
    const { faqList } = this.data
    const index = faqList.findIndex(item => item.id === id)
    
    if (index !== -1) {
      const key = `faqList[${index}].expanded`
      this.setData({
        [key]: !faqList[index].expanded,
      })
    }
  },

  /**
   * 选择反馈类型
   */
  onFeedbackTypeChange(e: any) {
    this.setData({
      'feedbackForm.typeIndex': e.detail.value,
    })
  },

  /**
   * 输入反馈内容
   */
  onFeedbackContentInput(e: any) {
    this.setData({
      'feedbackForm.content': e.detail.value,
    })
  },

  /**
   * 输入联系方式
   */
  onContactInput(e: any) {
    this.setData({
      'feedbackForm.contact': e.detail.value,
    })
  },

  /**
   * 提交反馈
   */
  onSubmitFeedback() {
    const { feedbackForm, submitting } = this.data
    
    if (submitting) return
    
    // 表单验证
    if (!feedbackForm.content.trim()) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none',
      })
      return
    }
    
    if (feedbackForm.content.trim().length < 10) {
      wx.showToast({
        title: '反馈内容至少10个字',
        icon: 'none',
      })
      return
    }

    // 模拟提交
    this.setData({ submitting: true })
    
    setTimeout(() => {
      this.setData({
        submitting: false,
        submitted: true,
        feedbackForm: {
          ...feedbackForm,
          content: '',
          contact: '',
        },
      })
      
      wx.showToast({
        title: '提交成功',
        icon: 'success',
      })
      
      // 3秒后重置提交状态
      setTimeout(() => {
        this.setData({ submitted: false })
      }, 3000)
    }, 1500)
  },

  /**
   * 联系客服操作
   */
  onContactAction(e: any) {
    const { action } = e.currentTarget.dataset
    
    switch (action) {
      case 'online':
        wx.showToast({
          title: '客服功能开发中',
          icon: 'none',
        })
        break
      case 'phone':
        wx.makePhoneCall({
          phoneNumber: '4008889999',
          fail: () => {
            wx.showToast({
              title: '拨打电话失败',
              icon: 'none',
            })
          },
        })
        break
      case 'email':
        wx.setClipboardData({
          data: 'support@auction.com',
          success: () => {
            wx.showToast({
              title: '邮箱已复制',
              icon: 'success',
            })
          },
        })
        break
    }
  },

  /**
   * 查看用户协议
   */
  onViewAgreement() {
    wx.showToast({
      title: '用户协议页面开发中',
      icon: 'none',
    })
  },

  /**
   * 查看隐私政策
   */
  onViewPrivacy() {
    wx.showToast({
      title: '隐私政策页面开发中',
      icon: 'none',
    })
  },
})