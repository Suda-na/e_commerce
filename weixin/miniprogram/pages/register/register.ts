// pages/register/register.ts

import { authService } from '../../services/auth.service'
import { validator } from '../../utils/validator'
import { setToken } from '../../utils/request'

const app = getApp<IAppOption>()

Page({
  data: {
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user' as 'user' | 'merchant',
    agreeTerms: false,
    
    showPassword: false,
    showConfirmPassword: false,
    loading: false,
    
    // 焦点状态
    usernameFocus: false,
    passwordFocus: false,
    confirmPasswordFocus: false,
    
    // 密码强度
    passwordStrength: 0,
    passwordStrengthText: '',
    reqLengthMet: false,
    reqCaseMet: false,
    reqSpecialMet: false,
    
    // 错误信息
    errors: {
      username: '',
      password: '',
      confirmPassword: '',
      agreement: ''
    } as Record<string, string>
  },

  onLoad() {
    console.log('Register page loaded')
  },

  // ==================== 用户名 ====================

  onUsernameInput(e: WechatMiniprogram.Input) {
    this.setData({
      username: e.detail.value,
      'errors.username': ''
    })
  },

  onUsernameFocus() {
    this.setData({ usernameFocus: true })
  },

  onUsernameBlur() {
    this.setData({ usernameFocus: false })
    this.validateUsername()
  },

  validateUsername(): boolean {
    const { username } = this.data
    
    if (!username) {
      this.setData({ 'errors.username': '请输入用户名' })
      return false
    }
    
    if (username.length < 5) {
      this.setData({ 'errors.username': '用户名至少5个字符' })
      return false
    }
    
    if (username.length > 50) {
      this.setData({ 'errors.username': '用户名不能超过50个字符' })
      return false
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      this.setData({ 'errors.username': '用户名只能包含字母、数字和下划线' })
      return false
    }
    
    if (/^\d/.test(username)) {
      this.setData({ 'errors.username': '用户名不能以数字开头' })
      return false
    }
    
    this.setData({ 'errors.username': '' })
    return true
  },

  // ==================== 密码 ====================

  onPasswordInput(e: WechatMiniprogram.Input) {
    const password = e.detail.value
    this.setData({
      password,
      'errors.password': ''
    })
    this.updatePasswordStrength(password)
    
    // 如果确认密码已输入，重新验证一致性
    if (this.data.confirmPassword) {
      this.validateConfirmPassword()
    }
  },

  onPasswordFocus() {
    this.setData({ passwordFocus: true })
  },

  onPasswordBlur() {
    this.setData({ passwordFocus: false })
    this.validatePassword()
  },

  validatePassword(): boolean {
    const { password } = this.data
    
    if (!password) {
      this.setData({ 'errors.password': '请输入密码' })
      return false
    }
    
    if (password.length < 6) {
      this.setData({ 'errors.password': '密码至少6个字符' })
      return false
    }
    
    if (password.length > 20) {
      this.setData({ 'errors.password': '密码不能超过20个字符' })
      return false
    }
    
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
      this.setData({ 'errors.password': '密码必须包含字母和数字' })
      return false
    }
    
    this.setData({ 'errors.password': '' })
    return true
  },

  // 更新密码强度
  updatePasswordStrength(password: string) {
    if (!password) {
      this.setData({ passwordStrength: 0, passwordStrengthText: '', reqLengthMet: false, reqCaseMet: false, reqSpecialMet: false })
      return
    }
    
    let strength = 0
    const reqLengthMet = password.length >= 8
    const reqCaseMet = /[a-z]/.test(password) && /[A-Z]/.test(password)
    const reqSpecialMet = /\d/.test(password) && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    
    if (reqLengthMet) strength++
    if (reqCaseMet) strength++
    if (reqSpecialMet) strength++
    
    const strengthTexts = ['', '弱', '中', '强']
    
    this.setData({
      passwordStrength: strength,
      passwordStrengthText: strengthTexts[strength] || '',
      reqLengthMet,
      reqCaseMet,
      reqSpecialMet
    })
  },

  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  // ==================== 确认密码 ====================

  onConfirmPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({
      confirmPassword: e.detail.value,
      'errors.confirmPassword': ''
    })
  },

  onConfirmPasswordFocus() {
    this.setData({ confirmPasswordFocus: true })
  },

  onConfirmPasswordBlur() {
    this.setData({ confirmPasswordFocus: false })
    this.validateConfirmPassword()
  },

  validateConfirmPassword(): boolean {
    const { password, confirmPassword } = this.data
    
    if (!confirmPassword) {
      this.setData({ 'errors.confirmPassword': '请再次输入密码' })
      return false
    }
    
    if (password !== confirmPassword) {
      this.setData({ 'errors.confirmPassword': '两次输入的密码不一致' })
      return false
    }
    
    this.setData({ 'errors.confirmPassword': '' })
    return true
  },

  toggleConfirmPassword() {
    this.setData({ showConfirmPassword: !this.data.showConfirmPassword })
  },

  // ==================== 角色选择 ====================
  // 用户端固定为用户角色，不提供角色选择
  // role 字段已在 data 中默认设置为 'user'

  // ==================== 用户协议 ====================

  toggleAgreement() {
    this.setData({
      agreeTerms: !this.data.agreeTerms,
      'errors.agreement': ''
    })
  },

  validateAgreement(): boolean {
    if (!this.data.agreeTerms) {
      this.setData({ 'errors.agreement': '请阅读并同意用户协议和隐私政策' })
      return false
    }
    this.setData({ 'errors.agreement': '' })
    return true
  },

  showTerms() {
    wx.showModal({
      title: '用户协议',
      content: '用户协议内容加载中...',
      showCancel: false
    })
  },

  showPrivacy() {
    wx.showModal({
      title: '隐私政策',
      content: '隐私政策内容加载中...',
      showCancel: false
    })
  },

  // ==================== 注册提交 ====================

  async handleRegister() {
    if (this.data.loading) return

    // 验证所有字段
    const usernameValid = this.validateUsername()
    const passwordValid = this.validatePassword()
    const confirmPasswordValid = this.validateConfirmPassword()
    const agreementValid = this.validateAgreement()

    if (!usernameValid || !passwordValid || !confirmPasswordValid || !agreementValid) {
      return
    }

    this.setData({ loading: true })

    try {
      const { username, password, role } = this.data
      
      // 调用注册API
      const result = await authService.register({
        username,
        password,
        role
      })
      
      wx.showToast({
        title: '注册成功',
        icon: 'success',
        duration: 1500
      })

      // 注册成功后自动登录
      // 后端返回 { user, accessToken, refreshToken }
      const token = result.accessToken || result.token
      const userInfo = result.user || result.userInfo
      
      if (token) {
        // 如果API直接返回了token，自动登录
        setToken(token)
        
        if (userInfo) {
          app.globalData.userInfo = userInfo
          app.globalData.isLoggedIn = true
          wx.setStorageSync('userInfo', userInfo)
        }

        setTimeout(() => {
          wx.switchTab({
            url: '/pages/discover/index'
          })
        }, 1500)
      } else {
        // 否则跳转到登录页
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }, 1500)
      }

    } catch (error: any) {
      console.error('注册失败:', error)
      
      let errorMessage = '注册失败，请重试'
      
      if (error.message) {
        if (error.message.includes('用户名已存在') || error.message.includes('username')) {
          errorMessage = '该用户名已被注册'
          this.setData({ 'errors.username': errorMessage })
        } else if (error.message.includes('网络')) {
          errorMessage = '网络异常，请检查网络连接'
        } else if (error.message.includes('timeout')) {
          errorMessage = '请求超时，请稍后重试'
        } else {
          errorMessage = error.message
        }
      }

      wx.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000
      })

    } finally {
      this.setData({ loading: false })
    }
  },

  // ==================== 页面跳转 ====================

  goToLogin() {
    wx.navigateBack({
      fail: () => {
        wx.redirectTo({
          url: '/pages/login/login'
        })
      }
    })
  }
})