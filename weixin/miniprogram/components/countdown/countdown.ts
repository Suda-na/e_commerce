// countdown.ts - 倒计时组件
Component({
  properties: {
    /** 结束时间（时间戳，毫秒） */
    endTime: {
      type: Number,
      value: 0,
      observer: 'restartTimer',
    },
  },

  data: {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    hoursText: '00',
    minutesText: '00',
    secondsText: '00',
    isFinished: false,
  },

  lifetimes: {
    attached() {
      this.startTimer()
    },
    detached() {
      this.stopTimer()
    },
  },

  methods: {
    /** 启动倒计时 */
    startTimer() {
      this.stopTimer()
      this.updateTime()
      this._timer = setInterval(() => {
        this.updateTime()
      }, 1000)
    },

    /** 停止倒计时 */
    stopTimer() {
      if (this._timer) {
        clearInterval(this._timer)
        this._timer = null
      }
    },

    /** 重启倒计时（endTime 变化时） */
    restartTimer() {
      this.setData({ isFinished: false })
      this.startTimer()
    },

    /** 更新时间显示 */
    updateTime() {
      const { endTime } = this.data
      const now = Date.now()
      const diff = endTime - now

      if (diff <= 0) {
        this.stopTimer()
        this.setData({ isFinished: true })
        this.triggerEvent('countdownFinish')
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      this.setData({
        days,
        hours,
        minutes,
        seconds,
        hoursText: String(hours).padStart(2, '0'),
        minutesText: String(minutes).padStart(2, '0'),
        secondsText: String(seconds).padStart(2, '0'),
      })
    },
  },
})
