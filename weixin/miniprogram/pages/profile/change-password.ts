// 修改密码页面逻辑
import { authService } from '../../services/auth.service'

Page({
  data: {
    // 表单数据
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    
    // 显示/隐藏密码
    showOldPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
    
    // 密码强度
    passwordStrength: 0, // 0-无, 1-弱, 2-中, 3-强
    passwordStrengthText: '',
    passwordStrengthColor: '',
    
    // 密码规则检查
    hasLetterAndNumber: false,
    
    // 表单状态
    loading: false,
    canSubmit: false,
    
    // 错误信息
    oldPasswordError: '',
    newPasswordError: '',
    confirmPasswordError: '',
  },

  onLoad() {
    console.log('Change password page loaded')
  },

  // 输入原密码
  onOldPasswordInput(e: WechatMiniprogram.Input) {
    const oldPassword = e.detail.value
    this.setData({ 
      oldPassword,
      oldPasswordError: ''
    })
    this.checkFormValid()
  },

  // 输入新密码
  onNewPasswordInput(e: WechatMiniprogram.Input) {
    const newPassword = e.detail.value
    const hasLetterAndNumber = /(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)
    this.setData({ 
      newPassword,
      newPasswordError: '',
      hasLetterAndNumber
    })
    this.checkPasswordStrength(newPassword)
    this.checkFormValid()
  },

  // 输入确认密码
  onConfirmPasswordInput(e: WechatMiniprogram.Input) {
    const confirmPassword = e.detail.value
    this.setData({ 
      confirmPassword,
      confirmPasswordError: ''
    })
    this.checkFormValid()
  },

  // 切换显示/隐藏原密码
  toggleOldPasswordVisibility() {
    this.setData({ showOldPassword: !this.data.showOldPassword })
  },

  // 切换显示/隐藏新密码
  toggleNewPasswordVisibility() {
    this.setData({ showNewPassword: !this.data.showNewPassword })
  },

  // 切换显示/隐藏确认密码
  toggleConfirmPasswordVisibility() {
    this.setData({ showConfirmPassword: !this.data.showConfirmPassword })
  },

  // 检查密码强度
  checkPasswordStrength(password: string) {
    let strength = 0
    let strengthText = ''
    let strengthColor = ''

    if (password.length === 0) {
      this.setData({ passwordStrength: 0, passwordStrengthText: '', passwordStrengthColor: '' })
      return
    }

    // 长度检查
    if (password.length >= 6) strength++
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    
    // 复杂度检查
    const hasNumber = /\d/.test(password)
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    
    if (hasNumber && hasLetter) strength++
    if (hasSpecial) strength++
    
    // 限制最大强度为3
    strength = Math.min(strength, 3)
    
    // 根据长度和复杂度综合判断
    if (password.length < 6) {
      strength = 1
    } else if (password.length < 8) {
      strength = Math.max(strength, 1)
    } else if (password.length < 12) {
      strength = Math.max(strength, 2)
    }
    
    switch (strength) {
      case 1:
        strengthText = '弱'
        strengthColor = '#ff4d4f'
        break
      case 2:
        strengthText = '中'
        strengthColor = '#faad14'
        break
      case 3:
        strengthText = '强'
        strengthColor = '#52c41a'
        break
      default:
        strengthText = '弱'
        strengthColor = '#ff4d4f'
    }

    this.setData({
      passwordStrength: strength,
      passwordStrengthText: strengthText,
      passwordStrengthColor: strengthColor
    })
  },

  // 检查表单是否有效
  checkFormValid() {
    const { oldPassword, newPassword, confirmPassword } = this.data
    const canSubmit = oldPassword.length >= 6 && 
                     newPassword.length >= 6 && 
                     confirmPassword.length >= 6 &&
                     newPassword === confirmPassword &&
                     newPassword !== oldPassword
    this.setData({ canSubmit })
  },

  // 验证表单
  validateForm(): boolean {
    const { oldPassword, newPassword, confirmPassword } = this.data
    let isValid = true

    // 验证原密码
    if (!oldPassword) {
      this.setData({ oldPasswordError: '请输入原密码' })
      isValid = false
    } else if (oldPassword.length < 6) {
      this.setData({ oldPasswordError: '密码长度至少6位' })
      isValid = false
    }

    // 验证新密码
    if (!newPassword) {
      this.setData({ newPasswordError: '请输入新密码' })
      isValid = false
    } else if (newPassword.length < 6) {
      this.setData({ newPasswordError: '密码长度至少6位' })
      isValid = false
    } else if (newPassword.length > 20) {
      this.setData({ newPasswordError: '密码长度不能超过20位' })
      isValid = false
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
      this.setData({ newPasswordError: '密码必须包含字母和数字' })
      isValid = false
    }

    // 验证确认密码
    if (!confirmPassword) {
      this.setData({ confirmPasswordError: '请确认新密码' })
      isValid = false
    } else if (confirmPassword !== newPassword) {
      this.setData({ confirmPasswordError: '两次输入的密码不一致' })
      isValid = false
    }

    // 验证新密码不能与原密码相同
    if (oldPassword && newPassword && oldPassword === newPassword) {
      this.setData({ newPasswordError: '新密码不能与原密码相同' })
      isValid = false
    }

    return isValid
  },

  // 提交修改密码
  async onSubmit() {
    if (!this.validateForm()) return
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const { oldPassword, newPassword } = this.data
      await authService.changePassword(oldPassword, newPassword)
      
      wx.showToast({
        title: '密码修改成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err: any) {
      console.error('修改密码失败:', err)
      
      let errorMessage = '修改密码失败，请重试'
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