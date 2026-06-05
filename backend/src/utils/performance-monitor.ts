import { performanceConfig } from '../config/performance.config';
import { logger } from './logger';
import { cacheManager } from './cache-manager';
import os from 'os';
import { EventEmitter } from 'events';

/**
 * 性能监控工具
 * 监控应用性能、系统资源、业务指标
 */

// 性能指标类型
interface PerformanceMetrics {
  timestamp: number;
  // 系统指标
  system: {
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    memoryFree: number;
    uptime: number;
    loadAverage: number[];
  };
  // 应用指标
  application: {
    eventLoopDelay: number;
    activeHandles: number;
    activeRequests: number;
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
  // 缓存指标
  cache: {
    hitRate: number;
    localSize: number;
    totalRequests: number;
    avgLatency: number;
  };
  // 业务指标
  business: {
    activeConnections: number;
    activeRooms: number;
    bidLatency: number;
    auctionLoad: number;
  };
}

// 告警类型
interface Alert {
  id: string;
  type: 'cpu' | 'memory' | 'eventLoop' | 'connections' | 'errorRate' | 'responseTime';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

// 性能监控器类
export class PerformanceMonitor extends EventEmitter {
  private metricsHistory: PerformanceMetrics[] = [];
  private alerts: Alert[] = [];
  private monitoringTimer: NodeJS.Timeout | null = null;
  private eventLoopTimer: NodeJS.Timeout | null = null;
  private lastEventLoopCheck: number = Date.now();
  private eventLoopDelay: number = 0;

  // 业务指标收集器
  private bidLatencies: number[] = [];
  private requestLatencies: number[] = [];
  private errorCount: number = 0;
  private requestCount: number = 0;
  private static readonly MAX_METRICS_HISTORY = 200; // 减少历史记录数量
  private static readonly MAX_LATENCIES_HISTORY = 200;

  constructor() {
    super();
    this.startEventLoopMonitoring();
  }

  // ========== 监控启动和停止 ==========

  /**
   * 启动性能监控
   */
  start(): void {
    if (this.monitoringTimer) {
      logger.warn('Performance monitor already started');
      return;
    }

    const interval = performanceConfig.monitoring.system.interval;
    
    this.monitoringTimer = setInterval(() => {
      this.collectMetrics();
    }, interval);

    logger.info(`Performance monitor started with interval: ${interval}ms`);
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.eventLoopTimer) {
      clearInterval(this.eventLoopTimer);
      this.eventLoopTimer = null;
    }

    logger.info('Performance monitor stopped');
  }

  // ========== 指标收集 ==========

  /**
   * 收集所有性能指标
   */
  private async collectMetrics(): Promise<void> {
    try {
      const metrics: PerformanceMetrics = {
        timestamp: Date.now(),
        system: this.collectSystemMetrics(),
        application: this.collectApplicationMetrics(),
        cache: this.collectCacheMetrics(),
        business: await this.collectBusinessMetrics(),
      };

      // 存储指标历史
      this.metricsHistory.push(metrics);
      
      // 保留最近200条记录（减少内存占用）
      if (this.metricsHistory.length > PerformanceMonitor.MAX_METRICS_HISTORY) {
        this.metricsHistory = this.metricsHistory.slice(-PerformanceMonitor.MAX_METRICS_HISTORY);
      }

      // 检查告警条件
      this.checkAlerts(metrics);

      // 发出指标事件
      this.emit('metrics', metrics);

      logger.debug('Performance metrics collected:', {
        cpu: metrics.system.cpuUsage,
        memory: metrics.system.memoryUsage,
        eventLoop: metrics.application.eventLoopDelay,
      });
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(): PerformanceMetrics['system'] {
    const cpus = os.cpus();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // 计算CPU使用率
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type of Object.keys(cpu.times)) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

    return {
      cpuUsage,
      memoryUsage: Math.round((usedMemory / totalMemory) * 100),
      memoryTotal: totalMemory,
      memoryFree: freeMemory,
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  /**
   * 收集应用指标
   */
  private collectApplicationMetrics(): PerformanceMetrics['application'] {
    const memoryUsage = process.memoryUsage();

    return {
      eventLoopDelay: this.eventLoopDelay,
      activeHandles: (process as any)._getActiveHandles().length,
      activeRequests: (process as any)._getActiveRequests().length,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
    };
  }

  /**
   * 收集缓存指标
   */
  private collectCacheMetrics(): PerformanceMetrics['cache'] {
    const stats = cacheManager.getStats();
    const hitRate = cacheManager.getHitRate();

    return {
      hitRate: hitRate.overall,
      localSize: stats.localSize,
      totalRequests: stats.totalRequests,
      avgLatency: stats.avgLatency,
    };
  }

  /**
   * 收集业务指标
   */
  private async collectBusinessMetrics(): Promise<PerformanceMetrics['business']> {
    // 这些指标需要从WebSocket优化器或其他服务获取
    // 这里返回默认值，实际使用时需要集成
    return {
      activeConnections: 0,
      activeRooms: 0,
      bidLatency: this.calculateAverage(this.bidLatencies),
      auctionLoad: 0,
    };
  }

  // ========== 事件循环监控 ==========

  /**
   * 启动事件循环延迟监控
   */
  private startEventLoopMonitoring(): void {
    const interval = 500; // 500ms检查一次（减少CPU开销）
    
    this.eventLoopTimer = setInterval(() => {
      const now = Date.now();
      const expected = this.lastEventLoopCheck + interval;
      this.eventLoopDelay = Math.max(0, now - expected);
      this.lastEventLoopCheck = now;
    }, interval);
  }

  // ========== 业务指标记录 ==========

  /**
   * 记录出价延迟
   */
  recordBidLatency(latency: number): void {
    this.bidLatencies.push(latency);
    
    // 保留最近50条记录
    if (this.bidLatencies.length > 50) {
      this.bidLatencies = this.bidLatencies.slice(-50);
    }
  }

  /**
   * 记录请求延迟
   */
  recordRequestLatency(latency: number): void {
    this.requestLatencies.push(latency);
    
    // 保留最近200条记录（减少内存占用）
    if (this.requestLatencies.length > PerformanceMonitor.MAX_LATENCIES_HISTORY) {
      this.requestLatencies = this.requestLatencies.slice(-PerformanceMonitor.MAX_LATENCIES_HISTORY);
    }
  }

  /**
   * 记录请求
   */
  recordRequest(): void {
    this.requestCount++;
  }

  /**
   * 记录错误
   */
  recordError(): void {
    this.errorCount++;
  }

  // ========== 告警系统 ==========

  /**
   * 检查告警条件
   */
  private checkAlerts(metrics: PerformanceMetrics): void {
    const thresholds = performanceConfig.monitoring.alerts.thresholds;
    const alerts: Alert[] = [];

    // CPU告警
    if (metrics.system.cpuUsage > performanceConfig.monitoring.system.cpuThreshold) {
      alerts.push({
        id: `cpu-${Date.now()}`,
        type: 'cpu',
        severity: metrics.system.cpuUsage > 95 ? 'critical' : 'warning',
        message: `CPU使用率过高: ${metrics.system.cpuUsage}%`,
        value: metrics.system.cpuUsage,
        threshold: performanceConfig.monitoring.system.cpuThreshold,
        timestamp: Date.now(),
      });
    }

    // 内存告警
    if (metrics.system.memoryUsage > performanceConfig.monitoring.system.memoryThreshold) {
      alerts.push({
        id: `memory-${Date.now()}`,
        type: 'memory',
        severity: metrics.system.memoryUsage > 95 ? 'critical' : 'warning',
        message: `内存使用率过高: ${metrics.system.memoryUsage}%`,
        value: metrics.system.memoryUsage,
        threshold: performanceConfig.monitoring.system.memoryThreshold,
        timestamp: Date.now(),
      });
    }

    // 事件循环延迟告警
    if (metrics.application.eventLoopDelay > performanceConfig.monitoring.system.eventLoopThreshold) {
      alerts.push({
        id: `eventLoop-${Date.now()}`,
        type: 'eventLoop',
        severity: metrics.application.eventLoopDelay > 500 ? 'critical' : 'warning',
        message: `事件循环延迟过高: ${metrics.application.eventLoopDelay}ms`,
        value: metrics.application.eventLoopDelay,
        threshold: performanceConfig.monitoring.system.eventLoopThreshold,
        timestamp: Date.now(),
      });
    }

    // 响应时间告警
    const avgLatency = this.calculateAverage(this.requestLatencies);
    if (avgLatency > thresholds.responseTime) {
      alerts.push({
        id: `responseTime-${Date.now()}`,
        type: 'responseTime',
        severity: avgLatency > thresholds.responseTime * 2 ? 'critical' : 'warning',
        message: `平均响应时间过高: ${avgLatency}ms`,
        value: avgLatency,
        threshold: thresholds.responseTime,
        timestamp: Date.now(),
      });
    }

    // 错误率告警
    if (this.requestCount > 100) {
      const errorRate = this.errorCount / this.requestCount;
      if (errorRate > thresholds.errorRate) {
        alerts.push({
          id: `errorRate-${Date.now()}`,
          type: 'errorRate',
          severity: errorRate > thresholds.errorRate * 2 ? 'critical' : 'warning',
          message: `错误率过高: ${(errorRate * 100).toFixed(2)}%`,
          value: errorRate,
          threshold: thresholds.errorRate,
          timestamp: Date.now(),
        });
      }
    }

    // 处理告警
    for (const alert of alerts) {
      this.alerts.push(alert);
      
      // 保留最近100条告警
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100);
      }

      // 发出告警事件
      this.emit('alert', alert);

      // 记录日志
      if (alert.severity === 'critical') {
        logger.error(`ALERT [${alert.type}]: ${alert.message}`);
      } else {
        logger.warn(`ALERT [${alert.type}]: ${alert.message}`);
      }
    }
  }

  // ========== 数据查询 ==========

  /**
   * 获取最新指标
   */
  getLatestMetrics(): PerformanceMetrics | null {
    return this.metricsHistory.length > 0 
      ? this.metricsHistory[this.metricsHistory.length - 1] 
      : null;
  }

  /**
   * 获取指标历史
   */
  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * 获取告警历史
   */
  getAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * 获取性能摘要
   */
  getPerformanceSummary(): {
    uptime: number;
    avgCpu: number;
    avgMemory: number;
    avgEventLoop: number;
    totalRequests: number;
    errorRate: number;
    cacheHitRate: number;
    activeAlerts: number;
  } {
    const recentMetrics = this.metricsHistory.slice(-60); // 最近60个数据点
    
    if (recentMetrics.length === 0) {
      return {
        uptime: process.uptime(),
        avgCpu: 0,
        avgMemory: 0,
        avgEventLoop: 0,
        totalRequests: this.requestCount,
        errorRate: 0,
        cacheHitRate: 0,
        activeAlerts: this.alerts.filter(a => Date.now() - a.timestamp < 300000).length,
      };
    }

    const avgCpu = recentMetrics.reduce((sum, m) => sum + m.system.cpuUsage, 0) / recentMetrics.length;
    const avgMemory = recentMetrics.reduce((sum, m) => sum + m.system.memoryUsage, 0) / recentMetrics.length;
    const avgEventLoop = recentMetrics.reduce((sum, m) => sum + m.application.eventLoopDelay, 0) / recentMetrics.length;
    
    const latestCache = recentMetrics[recentMetrics.length - 1].cache;
    const errorRate = this.requestCount > 0 ? this.errorCount / this.requestCount : 0;

    return {
      uptime: process.uptime(),
      avgCpu: Math.round(avgCpu * 100) / 100,
      avgMemory: Math.round(avgMemory * 100) / 100,
      avgEventLoop: Math.round(avgEventLoop * 100) / 100,
      totalRequests: this.requestCount,
      errorRate: Math.round(errorRate * 10000) / 10000,
      cacheHitRate: latestCache.hitRate,
      activeAlerts: this.alerts.filter(a => Date.now() - a.timestamp < 300000).length,
    };
  }

  // ========== 辅助方法 ==========

  /**
   * 计算平均值
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round((sum / values.length) * 100) / 100;
  }

  /**
   * 重置计数器
   */
  resetCounters(): void {
    this.errorCount = 0;
    this.requestCount = 0;
    this.bidLatencies = [];
    this.requestLatencies = [];
  }

  /**
   * 导出指标为JSON
   */
  exportMetrics(): string {
    return JSON.stringify({
      summary: this.getPerformanceSummary(),
      latestMetrics: this.getLatestMetrics(),
      recentAlerts: this.getAlerts(20),
      timestamp: Date.now(),
    }, null, 2);
  }
}

// 创建全局性能监控器实例
export const performanceMonitor = new PerformanceMonitor();

// 导出监控中间件
export function performanceMiddleware() {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // 记录请求
    performanceMonitor.recordRequest();

    // 监听响应完成
    res.on('finish', () => {
      const latency = Date.now() - startTime;
      performanceMonitor.recordRequestLatency(latency);

      // 记录错误
      if (res.statusCode >= 400) {
        performanceMonitor.recordError();
      }
    });

    next();
  };
}

export default performanceMonitor;