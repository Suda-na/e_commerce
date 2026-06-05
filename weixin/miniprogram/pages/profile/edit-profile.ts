// 编辑资料页面逻辑
const app = getApp<IAppOption>()
import { authService } from '../../services/auth.service'
import { request } from '../../utils/request'
import { validator } from '../../utils/validator'

Page({
  data: {
    // 用户信息
    avatarUrl: '',
    nickname: '',
    phone: '',
    email: '',
    
    // 表单状态
    loading: false,
    saving: false,
    hasChanges: false,
    
    // 验证错误
    errors: {
      nickname: '',
      phone: '',
      email: '',
    },
    
    // 原始数据（用于检测变化）
    originalData: {
      avatarUrl: '',
      nickname: '',
      phone: '',
      email: '',
    },
  },

  onLoad() {
    this.loadUserInfo()
  },

  // 加载用户信息
  async loadUserInfo() {
    this.setData({ loading: true })
    
    try {
      const res = await authService.getUserInfo()
      // authService.getUserInfo() 返回 res.data，即 { success: true, data: user }
      // 需要提取 data.data 获取实际用户信息
      const data = res?.data || res || null
      
      if (data) {
        const userInfo = {
          avatarUrl: data.avatarUrl || data.avatar || '',
          nickname: data.nickname || data.username || '',
          phone: data.phone || '',
          email: data.email || '',
        }
        
        this.setData({
          ...userInfo,
          originalData: { ...userInfo },
          loading: false,
        })
      }
    } catch (err) {
      console.log('获取用户信息失败', err)
      wx.showToast({
        title: '获取用户信息失败',
        icon: 'none',
      })
      this.setData({ loading: false })
    }
  },

  // 选择头像
  onChooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        this.setData({
          avatarUrl: tempFilePath,
          hasChanges: true,
        })
        // 上传头像
        this.uploadAvatar(tempFilePath)
      },
    })
  },

  // 上传头像（两步流程：先上传图片获取URL，再通过profile更新保存）
  async uploadAvatar(filePath: string) {
    wx.showLoading({ title: '上传中...', mask: true })
    
    try {
      // 调用后端 POST /api/auth/avatar 上传头像
      // 后端会同时上传到图床并更新用户avatar字段
      const res = await request.upload('/auth/avatar', filePath, 'avatar')
      
      // res 结构: { success, data: { url, user }, message }
      const uploadData = res?.data
      if (uploadData?.url) {
        this.setData({
          avatarUrl: uploadData.url,
        })
        wx.showToast({
          title: '头像上传成功',
          icon: 'success',
        })
      } else if (res?.success === false) {
        throw new Error(res?.message || '上传失败')
      }
    } catch (err: any) {
      console.error('头像上传失败', err)
      // 上传失败时恢复原头像
      this.setData({
        avatarUrl: this.data.originalData.avatarUrl,
      })
      wx.showToast({
        title: err?.message || '头像上传失败',
        icon: 'none',
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 输入昵称
  onNicknameInput(e: WechatMiniprogram.Input) {
    const nickname = e.detail.value
    this.setData({
      nickname,
      hasChanges: true,
      'errors.nickname': '',
    })
  },

  // 输入手机号
  onPhoneInput(e: WechatMiniprogram.Input) {
    const phone = e.detail.value
    this.setData({
      phone,
      hasChanges: true,
      'errors.phone': '',
    })
  },

  // 输入邮箱
  onEmailInput(e: WechatMiniprogram.Input) {
    const email = e.detail.value
    this.setData({
      email,
      hasChanges: true,
      'errors.email': '',
    })
  },

  // 验证表单
  validateForm(): boolean {
    const { nickname, phone, email } = this.data
    const errors = {
      nickname: '',
      phone: '',
      email: '',
    }
    let isValid = true

    // 验证昵称
    const nicknameResult = validator.validateUsername(nickname)
    if (!nicknameResult.valid) {
      errors.nickname = nicknameResult.message || '昵称格式不正确'
      isValid = false
    }

    // 验证手机号（可选）
    if (phone) {
      const phoneResult = validator.validatePhone(phone)
      if (!phoneResult.valid) {
        errors.phone = phoneResult.message || '手机号格式不正确'
        isValid = false
      }
    }

    // 验证邮箱（可选）
    if (email) {
      const emailResult = validator.validateEmail(email)
      if (!emailResult.valid) {
        errors.email = emailResult.message || '邮箱格式不正确'
        isValid = false
      }
    }

    this.setData({ errors })
    return isValid
  },

  // 保存资料
  async onSave() {
    if (this.data.saving) return
    
    // 验证表单
    if (!this.validateForm()) {
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...', mask: true })

    try {
      const { nickname, phone, email, avatarUrl } = this.data
      
      // 字段映射：前端 nickname → 后端 username
      const updateData: any = {
        username: nickname,
      }
      
      if (phone) {
        updateData.phone = phone
      }
      
      if (email) {
        updateData.email = email
      }
      
      if (avatarUrl && !avatarUrl.startsWith('wxfile://') && !avatarUrl.startsWith('http://tmp/')) {
        updateData.avatar = avatarUrl
      }

      const res = await authService.updateUserInfo(updateData)
      
      // authService.updateUserInfo() 返回 res.data，即 { success, data: user }
      if (res) {
        // 更新全局用户信息（映射回前端字段名）
        const updatedUser = res?.data || res
        app.setUserInfo({
          ...app.globalData.userInfo,
          ...updatedUser,
          nickname: updatedUser?.username || nickname,
        })
        
        this.setData({ hasChanges: false })
        
        wx.showToast({
          title: '保存成功',
          icon: 'success',
        })
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (err) {
      console.error('保存失败', err)
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
      })
    } finally {
      this.setData({ saving: false })
      wx.hideLoading()
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadUserInfo().finally(() => {
      wx.stopPullDownRefresh()
    })
  },
})