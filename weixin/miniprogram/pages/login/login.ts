// pages/login/login.ts

import { authService } from '../../services/auth.service'
import { validator } from '../../utils/validator'
import { setToken } from '../../utils/request'

const app = getApp<IAppOption>()

Page({
  data: {
    username: '',
    password: '',
    showPassword: false,
    rememberMe: false,
    loading: false,
    showOtherLogin: false, // P2功能，暂时隐藏
    
    // 焦点状态
    usernameFocus: false,
    passwordFocus: false,
    
    // 错误信息
    errors: {
      username: '',
      password: ''
    } as Record<string, string>
  },

  onLoad() {
    console.log('Login page loaded')
    this.checkRememberedUser()
  },

  // 检查记住的用户
  checkRememberedUser() {
    const rememberedUser = wx.getStorageSync('rememberedUser')
    if (rememberedUser) {
      this.setData({
        username: rememberedUser.username,
        rememberMe: true
      })
    }
  },

  // 用户名输入
  onUsernameInput(e: WechatMiniprogram.Input) {
    this.setData({
      username: e.detail.value,
      'errors.username': ''
    })
  },

  // 用户名获得焦点
  onUsernameFocus() {
    this.setData({ usernameFocus: true })
  },

  // 用户名失去焦点
  onUsernameBlur() {
    this.setData({ usernameFocus: false })
    this.validateUsername()
  },

  // 验证用户名
  validateUsername() {
    const { username } = this.data
    const result = validator.validateUsername(username)
    this.setData({
      'errors.username': result.valid ? '' : result.message || ''
    })
    return result.valid
  },

  // 密码输入
  onPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({
      password: e.detail.value,
      'errors.password': ''
    })
  },

  // 密码获得焦点
  onPasswordFocus() {
    this.setData({ passwordFocus: true })
  },

  // 密码失去焦点
  onPasswordBlur() {
    this.setData({ passwordFocus: false })
    this.validatePassword()
  },

  // 验证密码
  validatePassword() {
    const { password } = this.data
    const result = validator.validatePassword(password)
    this.setData({
      'errors.password': result.valid ? '' : result.message || ''
    })
    return result.valid
  },

  // 切换密码显示
  togglePassword() {
    this.setData({
      showPassword: !this.data.showPassword
    })
  },

  // 切换记住我
  toggleRemember() {
    this.setData({
      rememberMe: !this.data.rememberMe
    })
  },

  // 处理登录
  async handleLogin() {
    // 防止重复提交
    if (this.data.loading) return

    // 验证表单
    const usernameValid = this.validateUsername()
    const passwordValid = this.validatePassword()

    if (!usernameValid || !passwordValid) {
      return
    }

    // 开始登录
    this.setData({ loading: true })

    try {
      const { username, password, rememberMe } = this.data
      
      // 调用登录API
      const result = await authService.passwordLogin(username, password)
      
      console.log('登录返回结果:', { hasToken: !!result.token, hasUser: !!result.userInfo })
      console.log('token:', result.token ? '***已隐藏***' : '无')
      console.log('userInfo:', result.userInfo)
      
      // 检查用户角色，商家不能登录用户端
      if (result.userInfo && result.userInfo.role === 'merchant') {
        wx.showToast({
          title: '商家账号请使用商家端登录',
          icon: 'none',
          duration: 2000
        })
        return
      }
      
      // 保存Token
      setToken(result.token)
      console.log('Token已保存，globalData.token:', app.globalData.token ? '***已隐藏***' : '无')
      
      // 保存用户信息
      app.globalData.userInfo = result.userInfo
      app.globalData.isLoggedIn = true
      wx.setStorageSync('userInfo', result.userInfo)
      
      // 处理记住我
      if (rememberMe) {
        wx.setStorageSync('rememberedUser', { username })
      } else {
        wx.removeStorageSync('rememberedUser')
      }

      // 显示成功提示
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      })

      // 跳转到上一个页面或首页
      setTimeout(() => {
        const pages = getCurrentPages()
        if (pages.length > 1) {
          // 有上一个页面，返回
          wx.navigateBack()
        } else {
          // 没有上一个页面，跳转到首页
          wx.switchTab({
            url: '/pages/discover/index'
          })
        }
      }, 1500)

    } catch (error: any) {
      console.error('登录失败:', error)
      
      // 处理不同类型的错误
      let errorMessage = '登录失败，请重试'
      
      if (error.message) {
        if (error.message.includes('用户名') || error.message.includes('密码')) {
          errorMessage = '用户名或密码错误'
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

  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: '/pages/register/register'
    })
  },

  // 微信登录 (P2功能)
  wxLogin() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  }
})