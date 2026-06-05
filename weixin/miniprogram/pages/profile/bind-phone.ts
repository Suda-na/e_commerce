// 绑定手机页面逻辑
import { authService } from '../../services/auth.service'

Page({
  data: {
    // 表单数据
    phone: '',
    verifyCode: '',
    
    // 表单状态
    loading: false,
    canSubmit: false,
    
    // 验证码相关
    countdown: 0,
    canSendCode: true,
    codeButtonText: '获取验证码',
    
    // 错误信息
    phoneError: '',
    codeError: '',
    
    // 当前绑定的手机号（用于显示）
    currentPhone: '',
    hasBoundPhone: false,
  },

  onLoad() {
    console.log('Bind phone page loaded')
    this.loadCurrentPhone()
  },

  // 加载当前绑定的手机号
  async loadCurrentPhone() {
    try {
      const res = await authService.getUserInfo()
      const data = res || null
      if (data && data.phone) {
        // 隐藏中间4位
        const maskedPhone = data.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
        this.setData({
          currentPhone: maskedPhone,
          hasBoundPhone: true,
          phone: data.phone // 预填原手机号
        })
      }
    } catch (err) {
      console.log('获取用户信息失败', err)
    }
  },

  // 输入手机号
  onPhoneInput(e: WechatMiniprogram.Input) {
    const phone = e.detail.value
    this.setData({
      phone,
      phoneError: ''
    })
    this.checkFormValid()
  },

  // 输入验证码
  onCodeInput(e: WechatMiniprogram.Input) {
    const verifyCode = e.detail.value
    this.setData({
      verifyCode,
      codeError: ''
    })
    this.checkFormValid()
  },

  // 发送验证码
  async onSendCode() {
    const { phone, canSendCode, countdown } = this.data
    
    if (!canSendCode || countdown > 0) return
    
    // 验证手机号
    if (!phone) {
      this.setData({ phoneError: '请输入手机号' })
      return
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      this.setData({ phoneError: '请输入正确的手机号' })
      return
    }
    
    this.setData({ canSendCode: false })
    
    try {
      await authService.sendVerifyCode(phone)
      
      wx.showToast({
        title: '验证码已发送',
        icon: 'success',
        duration: 2000
      })
      
      // 开始倒计时
      this.startCountdown()
    } catch (err: any) {
      console.error('发送验证码失败:', err)
      
      let errorMessage = '发送验证码失败，请重试'
      if (err.message) {
        errorMessage = err.message
      } else if (err.data?.message) {
        errorMessage = err.data.message
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
      
      this.setData({ canSendCode: true })
    }
  },

  // 开始倒计时
  startCountdown() {
    let countdown = 60
    this.setData({
      countdown,
      codeButtonText: `${countdown}秒后重试`
    })
    
    const timer = setInterval(() => {
      countdown--
      if (countdown <= 0) {
        clearInterval(timer)
        this.setData({
          countdown: 0,
          canSendCode: true,
          codeButtonText: '获取验证码'
        })
      } else {
        this.setData({
          countdown,
          codeButtonText: `${countdown}秒后重试`
        })
      }
    }, 1000)
  },

  // 检查表单是否有效
  checkFormValid() {
    const { phone, verifyCode } = this.data
    const canSubmit = phone.length === 11 && verifyCode.length === 6
    this.setData({ canSubmit })
  },

  // 验证表单
  validateForm(): boolean {
    const { phone, verifyCode } = this.data
    let isValid = true

    // 验证手机号
    if (!phone) {
      this.setData({ phoneError: '请输入手机号' })
      isValid = false
    } else if (phone.length !== 11) {
      this.setData({ phoneError: '手机号长度应为11位' })
      isValid = false
    } else if (!/^1[3-9]\d{9}$/.test(phone)) {
      this.setData({ phoneError: '请输入正确的手机号' })
      isValid = false
    }

    // 验证验证码
    if (!verifyCode) {
      this.setData({ codeError: '请输入验证码' })
      isValid = false
    } else if (verifyCode.length !== 6) {
      this.setData({ codeError: '验证码长度应为6位' })
      isValid = false
    } else if (!/^\d{6}$/.test(verifyCode)) {
      this.setData({ codeError: '验证码应为6位数字' })
      isValid = false
    }

    return isValid
  },

  // 提交绑定手机
  async onSubmit() {
    if (!this.validateForm()) return
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const { phone, verifyCode } = this.data
      await authService.bindPhone(phone, verifyCode)
      
      wx.showToast({
        title: '绑定成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err: any) {
      console.error('绑定手机失败:', err)
      
      let errorMessage = '绑定失败，请重试'
      if (err.message) {
        errorMessage = err.message
      } else if (err.data?.message) {
        errorMessage = err.data.message
      }
      
      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 3000
      })
    } finally {
      this.setData({ loading: false })
    }
  },

})