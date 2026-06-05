/**
 * danmaku.ts - 弹幕评论组件
 *
 * 功能：
 * 1. 从底部滚入的新消息动画（右侧滑入 + 淡入）
 * 2. 用户头像和等级显示
 * 3. 最多保留 maxVisible（默认5）条消息
 * 4. 旧消息向上滚动消失
 *
 * 数据结构：{ id, avatar, level, nickname, content, timestamp, type }
 */

export interface DanmakuItem {
  id: string
  avatar?: string
  level?: number
  nickname: string
  content: string
  timestamp: number
  type?: 'comment' | 'bid' | 'system'
}

Component({
  properties: {
    /** 弹幕消息列表 */
    messages: {
      type: Array,
      value: [] as DanmakuItem[],
    },
    /** 最大显示条数 */
    maxVisible: {
      type: Number,
      value: 5,
    },
    /** 显示头像 */
    showAvatar: {
      type: Boolean,
      value: true,
    },
    /** 显示等级 */
    showLevel: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    /** 当前展示的消息（最多 maxVisible 条） */
    visibleMessages: [] as DanmakuItem[],
    /** 新增消息的 id 集合，用于触发入场动画 */
    newMessageIds: new Set<string>(),
    /** 需要退出动画的消息 id 集合 */
    exitingMessageIds: [] as string[],
  },

  observers: {
    /** 监听消息列表变化，裁剪到最大显示条数 */
    messages(newMessages: DanmakuItem[]) {
      if (!newMessages || newMessages.length === 0) {
        this.setData({ visibleMessages: [] })
        return
      }

      const maxVisible = this.data.maxVisible
      const currentVisible = this.data.visibleMessages

      // 取最新的 maxVisible 条
      const visible = newMessages.slice(-maxVisible)

      // 找出新增的消息 id
      const currentIds = new Set(currentVisible.map(m => m.id))
      const newIds = visible.filter(m => !currentIds.has(m.id)).map(m => m.id)

      // 找出需要退出的消息（之前在展示但不在新列表中）
      const newIdSet = new Set(visible.map(m => m.id))
      const exitingIds = currentVisible.filter(m => !newIdSet.has(m.id)).map(m => m.id)

      if (exitingIds.length > 0) {
        // 先播放退出动画
        this.setData({ exitingMessageIds: exitingIds })
        setTimeout(() => {
          this.setData({
            visibleMessages: visible,
            exitingMessageIds: [],
          })
        }, 200) // 退出动画时长
      } else {
        this.setData({ visibleMessages: visible })
      }

      // 标记新消息，1秒后清除入场动画标记
      if (newIds.length > 0) {
        setTimeout(() => {
          // 入场动画完成后不需要特殊处理，CSS animation 只播放一次
        }, 500)
      }
    },
  },

  methods: {
    /** 获取消息的类型样式类 */
    getMessageClass(item: DanmakuItem): string {
      const classes = ['danmaku-item', `danmaku-type-${item.type || 'comment'}`]
      return classes.join(' ')
    },

    /** 格式化等级文本 */
    formatLevel(level?: number): string {
      if (!level || level <= 0) return 'Lv1'
      return `Lv${level}`
    },

    /** 获取等级样式类 */
    getLevelClass(level?: number): string {
      if (!level || level <= 3) return 'level-low'
      if (level <= 10) return 'level-mid'
      return 'level-high'
    },

    /** 获取默认头像 */
    getDefaultAvatar(): string {
      return '/assets/icons/default-avatar.png'
    },
  },
})
