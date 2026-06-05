// bottom-sheet.ts
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    height: {
      type: String,
      value: 'auto'
    },
    maxHeight: {
      type: String,
      value: '85%'
    }
  },

  data: {
    animationData: {},
    startY: 0,
    currentY: 0,
    isDragging: false,
    translateY: 0,
    threshold: 150 // 拖拽关闭阈值（rpx）
  },

  methods: {
    // 关闭弹窗
    onClose() {
      this.triggerEvent('close')
    },

    // 阻止滚动穿透
    preventTouchMove() {
      return
    },

    // 内容区域点击
    onContentTap() {
      // 阻止事件冒泡
    },

    // 触摸开始
    onTouchStart(e: WechatMiniprogram.TouchEvent) {
      this.setData({
        startY: e.touches[0].clientY,
        isDragging: true,
        currentY: e.touches[0].clientY
      })
    },

    // 触摸移动
    onTouchMove(e: WechatMiniprogram.TouchEvent) {
      if (!this.data.isDragging) return
      
      const currentY = e.touches[0].clientY
      const diff = currentY - this.data.startY
      
      // 只允许向下拖拽
      if (diff > 0) {
        this.setData({
          currentY: currentY,
          translateY: diff
        })
      }
    },

    // 触摸结束
    onTouchEnd() {
      if (!this.data.isDragging) return
      
      const { translateY, threshold } = this.data
      this.setData({ isDragging: false })
      
      if (translateY > threshold) {
        // 超过阈值，关闭弹窗
        this.onClose()
      } else {
        // 未超过阈值，回弹
        this.setData({ translateY: 0 })
      }
    },

    // 拖拽区域点击（阻止冒泡）
    onDragAreaTap() {
      // 阻止事件冒泡
    }
  },

  observers: {
    'visible': function(visible) {
      if (visible) {
        // 显示动画
        const animation = wx.createAnimation({
          duration: 300,
          timingFunction: 'ease'
        })
        animation.translateY(0).step()
        this.setData({
          animationData: animation.export(),
          translateY: 0
        })
      } else {
        // 隐藏动画
        const animation = wx.createAnimation({
          duration: 300,
          timingFunction: 'ease'
        })
        animation.translateY('100%').step()
        this.setData({
          animationData: animation.export(),
          translateY: 0
        })
      }
    }
  }
})