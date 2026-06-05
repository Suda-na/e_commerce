// skeleton.ts - 骨架屏组件
Component({
  properties: {
    // 是否显示骨架屏
    loading: {
      type: Boolean,
      value: true
    },
    // 骨架屏类型
    type: {
      type: String,
      value: 'default' // default | list | card | detail | profile
    },
    // 行数（用于 list 类型）
    rows: {
      type: Number,
      value: 3
    },
    // 是否显示头像
    avatar: {
      type: Boolean,
      value: false
    },
    // 头像形状
    avatarShape: {
      type: String,
      value: 'circle' // circle | square
    },
    // 是否显示标题
    title: {
      type: Boolean,
      value: true
    },
    // 是否显示段落
    paragraph: {
      type: Boolean,
      value: true
    },
    // 段落行数
    paragraphRows: {
      type: Number,
      value: 3
    },
    // 是否激活动画
    animate: {
      type: Boolean,
      value: true
    }
  },

  data: {
    // 列表项数据（用于 list 类型）
    listItems: [] as number[],
    // 卡片数据（用于 card 类型）
    cardItems: [] as number[]
  },

  observers: {
    'type, rows': function(type: string, rows: number) {
      this.updateItems(type, rows)
    }
  },

  lifetimes: {
    attached() {
      this.updateItems(this.data.type, this.data.rows)
    }
  },

  methods: {
    updateItems(type: string, rows: number) {
      if (type === 'list') {
        this.setData({
          listItems: Array.from({ length: rows }, (_, i) => i)
        })
      } else if (type === 'card') {
        this.setData({
          cardItems: Array.from({ length: rows }, (_, i) => i)
        })
      }
    }
  }
})
