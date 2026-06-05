/**
 * 事件总线
 * 用于跨页面通信和状态同步
 */

type EventCallback = (data?: any) => void

class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map()

  /**
   * 监听事件
   * @param event 事件名称
   * @param callback 回调函数
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  /**
   * 取消监听
   * @param event 事件名称
   * @param callback 回调函数
   */
  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      // 移除该事件的所有监听器
      this.listeners.delete(event)
      return
    }

    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index > -1) {
        callbacks.splice(index, 1)
      }
      if (callbacks.length === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param data 传递的数据
   */
  emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`EventBus: 事件 "${event}" 处理出错`, error)
        }
      })
    }
  }

  /**
   * 一次性监听
   * @param event 事件名称
   * @param callback 回调函数
   */
  once(event: string, callback: EventCallback): void {
    const onceCallback = (data?: any) => {
      callback(data)
      this.off(event, onceCallback)
    }
    this.on(event, onceCallback)
  }

  /**
   * 清除所有监听器
   */
  clear(): void {
    this.listeners.clear()
  }
}

// 全局单例
export const eventBus = new EventBus()

// 事件名称常量
export const EVENTS = {
  // 未读消息数变化
  UNREAD_COUNT_CHANGE: 'unread_count_change',
  // 通知已读状态变化
  NOTIFICATION_READ_CHANGE: 'notification_read_change',
  // 新通知到达
  NEW_NOTIFICATION: 'new_notification',
  // 登录状态变化
  LOGIN_STATE_CHANGE: 'login_state_change',
} as const