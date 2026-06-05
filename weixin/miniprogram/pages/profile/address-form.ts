// 收货地址页面逻辑
import { authService } from '../../services/auth.service'

Page({
  data: {
    // 表单数据
    receiverName: '',
    receiverPhone: '',
    province: '',
    city: '',
    district: '',
    detailAddress: '',

    // 表单状态
    loading: false,
    canSubmit: false,
    isEdit: false, // 是否是编辑模式（已有地址）

    // 错误信息
    nameError: '',
    phoneError: '',
    addressError: '',

    // 省市区数据（简化版，实际可接入地区选择器）
    region: [] as string[],
  },

  onLoad() {
    console.log('Address form page loaded')
    this.loadCurrentAddress()
  },

  // 加载当前收货地址
  async loadCurrentAddress() {
    this.setData({ loading: true })
    try {
      const res = await authService.getUserInfo()
      const data = res || null
      if (data) {
        const hasAddress = data.receiver_name || data.province
        this.setData({
          receiverName: data.receiver_name || '',
          receiverPhone: data.receiver_phone || '',
          province: data.province || '',
          city: data.city || '',
          district: data.district || '',
          detailAddress: data.detail_address || '',
          isEdit: !!hasAddress,
          region: data.province ? [data.province, data.city || '', data.district || ''] : [],
        })
        this.checkFormValid()
      }
    } catch (err) {
      console.log('获取用户信息失败', err)
    } finally {
      this.setData({ loading: false })
    }
  },

  // 输入收货人姓名
  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({
      receiverName: e.detail.value,
      nameError: ''
    })
    this.checkFormValid()
  },

  // 输入收货人手机号
  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({
      receiverPhone: e.detail.value,
      phoneError: ''
    })
    this.checkFormValid()
  },

  // 选择省市区
  onRegionChange(e: WechatMiniprogram.PickerChange) {
    const region = e.detail.value as string[]
    this.setData({
      region,
      province: region[0] || '',
      city: region[1] || '',
      district: region[2] || '',
      addressError: ''
    })
    this.checkFormValid()
  },

  // 输入详细地址
  onAddressInput(e: WechatMiniprogram.Input) {
    this.setData({
      detailAddress: e.detail.value,
      addressError: ''
    })
    this.checkFormValid()
  },

  // 检查表单是否有效
  checkFormValid() {
    const { receiverName, receiverPhone, province, detailAddress } = this.data
    const canSubmit = 
      receiverName.trim().length >= 2 && 
      receiverPhone.length === 11 && 
      province !== '' && 
      detailAddress.trim().length >= 5
    this.setData({ canSubmit })
  },

  // 验证表单
  validateForm(): boolean {
    const { receiverName, receiverPhone, province, detailAddress } = this.data
    let isValid = true

    // 验证收货人姓名
    if (!receiverName.trim()) {
      this.setData({ nameError: '请输入收货人姓名' })
      isValid = false
    } else if (receiverName.trim().length < 2) {
      this.setData({ nameError: '姓名至少2个字符' })
      isValid = false
    } else if (receiverName.trim().length > 50) {
      this.setData({ nameError: '姓名最多50个字符' })
      isValid = false
    }

    // 验证手机号
    if (!receiverPhone) {
      this.setData({ phoneError: '请输入收货人手机号' })
      isValid = false
    } else if (receiverPhone.length !== 11) {
      this.setData({ phoneError: '手机号长度应为11位' })
      isValid = false
    } else if (!/^1[3-9]\d{9}$/.test(receiverPhone)) {
      this.setData({ phoneError: '请输入正确的手机号' })
      isValid = false
    }

    // 验证省市区
    if (!province) {
      this.setData({ addressError: '请选择省市区' })
      isValid = false
    }

    // 验证详细地址
    if (!detailAddress.trim()) {
      this.setData({ addressError: '请输入详细地址' })
      isValid = false
    } else if (detailAddress.trim().length < 5) {
      this.setData({ addressError: '详细地址至少5个字符' })
      isValid = false
    } else if (detailAddress.trim().length > 255) {
      this.setData({ addressError: '详细地址最多255个字符' })
      isValid = false
    }

    return isValid
  },

  // 提交保存地址
  async onSubmit() {
    if (!this.validateForm()) return
    if (this.data.loading) return

    this.setData({ loading: true })

    try {
      const { receiverName, receiverPhone, province, city, district, detailAddress } = this.data
      
      await authService.updateUserInfo({
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone,
        province,
        city,
        district,
        detail_address: detailAddress.trim(),
      })

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟返回上一页
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (err: any) {
      console.error('保存地址失败:', err)
      
      let errorMessage = '保存失败，请重试'
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

  // 清空表单
  onClear() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有地址信息吗？',
      confirmText: '清空',
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            receiverName: '',
            receiverPhone: '',
            province: '',
            city: '',
            district: '',
            detailAddress: '',
            region: [],
            nameError: '',
            phoneError: '',
            addressError: '',
            canSubmit: false,
          })
        }
      }
    })
  },
})