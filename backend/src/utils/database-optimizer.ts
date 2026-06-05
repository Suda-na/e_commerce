import { sequelize } from '../config/database';
import { performanceConfig } from '../config/performance.config';
import { logger } from './logger';
import { QueryTypes } from 'sequelize';

/**
 * 数据库优化器
 * 提供索引优化、查询优化、连接池监控等功能
 */

// 索引信息
interface IndexInfo {
  table: string;
  column: string;
  indexName: string;
  unique: boolean;
  cardinality: number;
}

// 查询统计
interface QueryStats {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: number;
}

// 连接池状态
interface PoolStatus {
  active: number;
  idle: number;
  waiting: number;
  total: number;
}

/**
 * 数据库优化器类
 */
export class DatabaseOptimizer {
  private queryStats: QueryStats[] = [];
  private slowQueryThreshold: number;

  constructor() {
    this.slowQueryThreshold = performanceConfig.database.queryOptimization.slowQueryThreshold;
  }

  // ========== 索引管理 ==========

  /**
   * 获取表的索引信息
   */
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    try {
      const dialect = sequelize.getDialect();
      let query: string;

      if (dialect === 'mysql') {
        query = `SHOW INDEX FROM ${tableName}`;
      } else if (dialect === 'postgres') {
        query = `
          SELECT 
            t.relname as table_name,
            a.attname as column_name,
            i.relname as index_name,
            ix.indisunique as unique,
            pg_stat_get_n_live_tup(t.oid) as cardinality
          FROM pg_class t
          JOIN pg_index ix ON t.oid = ix.indrelid
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
          WHERE t.relname = '${tableName}'
        `;
      } else if (dialect === 'sqlite') {
        query = `PRAGMA index_list('${tableName}')`;
      } else {
        throw new Error(`Unsupported dialect: ${dialect}`);
      }

      const results = await sequelize.query(query, { type: QueryTypes.SELECT });
      
      return this.parseIndexResults(results, tableName, dialect);
    } catch (error) {
      logger.error(`Failed to get indexes for table ${tableName}:`, error);
      return [];
    }
  }

  /**
   * 解析索引查询结果
   */
  private parseIndexResults(results: any[], tableName: string, dialect: string): IndexInfo[] {
    if (dialect === 'mysql') {
      const indexMap = new Map<string, IndexInfo>();
      
      for (const row of results) {
        const key = `${row.Key_name}-${row.Column_name}`;
        if (!indexMap.has(key)) {
          indexMap.set(key, {
            table: tableName,
            column: row.Column_name,
            indexName: row.Key_name,
            unique: row.Non_unique === 0,
            cardinality: row.Cardinality || 0,
          });
        }
      }
      
      return Array.from(indexMap.values());
    }
    
    // 简化处理其他数据库
    return results.map(row => ({
      table: tableName,
      column: row.column_name || row.name,
      indexName: row.index_name || row.indexname,
      unique: row.unique || false,
      cardinality: row.cardinality || 0,
    }));
  }

  /**
   * 创建索引（如果不存在）
   */
  async createIndex(
    tableName: string,
    columns: string[],
    options?: {
      unique?: boolean;
      indexName?: string;
      concurrently?: boolean;
    }
  ): Promise<boolean> {
    try {
      const indexName = options?.indexName || `idx_${tableName}_${columns.join('_')}`;

      // 先检查索引是否已存在
      const existingIndexes = await this.getTableIndexes(tableName);
      const indexExists = existingIndexes.some(idx => idx.indexName === indexName);
      if (indexExists) {
        logger.debug(`Index already exists, skipping: ${indexName} on ${tableName}`);
        return true;
      }

      const unique = options?.unique ? 'UNIQUE' : '';
      const concurrently = options?.concurrently ? 'CONCURRENTLY' : '';
      
      const query = `CREATE ${unique} INDEX ${concurrently} ${indexName} ON ${tableName} (${columns.join(', ')})`;
      
      await sequelize.query(query);
      
      logger.info(`Index created: ${indexName} on ${tableName}`);
      return true;
    } catch (error: any) {
      // 处理索引已存在的错误（不同数据库错误码不同）
      const errorCode = error?.original?.code || error?.parent?.code;
      const errorMsg = error?.message || '';
      if (
        errorCode === 'ER_DUP_KEYNAME' || // MySQL
        errorCode === '42P07' ||           // PostgreSQL
        errorCode === 'SQLITE_ERROR' ||    // SQLite
        errorMsg.includes('already exists') ||
        errorMsg.includes('Duplicate key name')
      ) {
        logger.debug(`Index already exists (DB reported), skipping: ${tableName}`);
        return true;
      }
      logger.error(`Failed to create index on ${tableName}:`, error);
      return false;
    }
  }

  /**
   * 删除索引
   */
  async dropIndex(indexName: string): Promise<boolean> {
    try {
      await sequelize.query(`DROP INDEX IF EXISTS ${indexName}`);
      logger.info(`Index dropped: ${indexName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to drop index ${indexName}:`, error);
      return false;
    }
  }

  /**
   * 分析表并更新索引统计
   */
  async analyzeTable(tableName: string): Promise<boolean> {
    try {
      const dialect = sequelize.getDialect();
      let query: string;

      if (dialect === 'mysql') {
        query = `ANALYZE TABLE ${tableName}`;
      } else if (dialect === 'postgres') {
        query = `ANALYZE ${tableName}`;
      } else if (dialect === 'sqlite') {
        query = `ANALYZE ${tableName}`;
      } else {
        throw new Error(`Unsupported dialect: ${dialect}`);
      }

      await sequelize.query(query);
      logger.info(`Table analyzed: ${tableName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to analyze table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * 根据配置创建推荐索引
   */
  async createRecommendedIndexes(): Promise<void> {
    const indexHints = performanceConfig.database.indexHints;
    
    for (const [table, columns] of Object.entries(indexHints)) {
      for (const column of columns) {
        try {
          await this.createIndex(table, [column], {
            indexName: `idx_${table}_${column}`,
          });
        } catch (error) {
          // 索引可能已存在，忽略错误
          logger.debug(`Index creation skipped for ${table}.${column}: ${error}`);
        }
      }
    }
  }

  // ========== 查询优化 ==========

  /**
   * 记录查询统计
   */
  recordQuery(query: string, executionTime: number, rowsAffected: number): void {
    const stats: QueryStats = {
      query: query.substring(0, 200), // 截断长查询
      executionTime,
      rowsAffected,
      timestamp: Date.now(),
    };

    this.queryStats.push(stats);

    // 保留最近1000条记录
    if (this.queryStats.length > 1000) {
      this.queryStats = this.queryStats.slice(-1000);
    }

    // 记录慢查询
    if (executionTime > this.slowQueryThreshold) {
      this.logSlowQuery(stats);
    }
  }

  /**
   * 记录慢查询
   */
  private logSlowQuery(stats: QueryStats): void {
    if (!performanceConfig.database.queryOptimization.logSlowQueries) {
      return;
    }

    logger.warn('Slow query detected:', {
      query: stats.query,
      executionTime: `${stats.executionTime}ms`,
      rowsAffected: stats.rowsAffected,
      timestamp: new Date(stats.timestamp).toISOString(),
    });
  }

  /**
   * 获取慢查询统计
   */
  getSlowQueries(limit: number = 20): QueryStats[] {
    return this.queryStats
      .filter(s => s.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * 获取查询统计摘要
   */
  getQueryStatsSummary(): {
    totalQueries: number;
    slowQueries: number;
    avgExecutionTime: number;
    maxExecutionTime: number;
    queriesPerSecond: number;
  } {
    if (this.queryStats.length === 0) {
      return {
        totalQueries: 0,
        slowQueries: 0,
        avgExecutionTime: 0,
        maxExecutionTime: 0,
        queriesPerSecond: 0,
      };
    }

    const slowQueries = this.queryStats.filter(s => s.executionTime > this.slowQueryThreshold);
    const totalTime = this.queryStats.reduce((sum, s) => sum + s.executionTime, 0);
    const maxTime = Math.max(...this.queryStats.map(s => s.executionTime));
    
    // 计算QPS（最近1分钟）
    const oneMinuteAgo = Date.now() - 60000;
    const recentQueries = this.queryStats.filter(s => s.timestamp > oneMinuteAgo);
    const qps = recentQueries.length / 60;

    return {
      totalQueries: this.queryStats.length,
      slowQueries: slowQueries.length,
      avgExecutionTime: Math.round(totalTime / this.queryStats.length),
      maxExecutionTime: maxTime,
      queriesPerSecond: Math.round(qps * 100) / 100,
    };
  }

  // ========== 连接池监控 ==========

  /**
   * 获取连接池状态
   */
  async getPoolStatus(): Promise<PoolStatus> {
    try {
      const pool = (sequelize as any).connectionManager?.pool;
      
      if (!pool) {
        return { active: 0, idle: 0, waiting: 0, total: 0 };
      }

      return {
        active: pool.used || 0,
        idle: pool.available || 0,
        waiting: pool.pending || 0,
        total: (pool.used || 0) + (pool.available || 0),
      };
    } catch (error) {
      logger.error('Failed to get pool status:', error);
      return { active: 0, idle: 0, waiting: 0, total: 0 };
    }
  }

  /**
   * 监控连接池健康状态
   */
  async checkPoolHealth(): Promise<{
    healthy: boolean;
    status: PoolStatus;
    issues: string[];
  }> {
    const status = await this.getPoolStatus();
    const issues: string[] = [];
    
    const config = performanceConfig.database.pool;
    
    // 检查连接数是否接近上限
    if (status.active > config.max * 0.8) {
      issues.push(`活跃连接数接近上限: ${status.active}/${config.max}`);
    }
    
    // 检查是否有等待的连接请求
    if (status.waiting > 0) {
      issues.push(`有连接请求在等待: ${status.waiting}`);
    }
    
    // 检查空闲连接是否过多
    if (status.idle > config.max * 0.5) {
      issues.push(`空闲连接过多: ${status.idle}`);
    }

    return {
      healthy: issues.length === 0,
      status,
      issues,
    };
  }

  // ========== 数据库维护 ==========

  /**
   * 优化表
   */
  async optimizeTable(tableName: string): Promise<boolean> {
    try {
      const dialect = sequelize.getDialect();
      let query: string;

      if (dialect === 'mysql') {
        query = `OPTIMIZE TABLE ${tableName}`;
      } else if (dialect === 'postgres') {
        query = `VACUUM ANALYZE ${tableName}`;
      } else if (dialect === 'sqlite') {
        query = `VACUUM`;
      } else {
        throw new Error(`Unsupported dialect: ${dialect}`);
      }

      await sequelize.query(query);
      logger.info(`Table optimized: ${tableName}`);
      return true;
    } catch (error) {
      logger.error(`Failed to optimize table ${tableName}:`, error);
      return false;
    }
  }

  /**
   * 获取表大小信息
   */
  async getTableSize(tableName: string): Promise<{
    rows: number;
    dataSize: string;
    indexSize: string;
    totalSize: string;
  } | null> {
    try {
      const dialect = sequelize.getDialect();
      
      if (dialect === 'mysql') {
        const query = `
          SELECT 
            TABLE_ROWS as rows,
            DATA_LENGTH as data_size,
            INDEX_LENGTH as index_size,
            DATA_LENGTH + INDEX_LENGTH as total_size
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tableName}'
        `;
        
        const results = await sequelize.query(query, { type: QueryTypes.SELECT });
        
        if (results.length > 0) {
          const row = results[0] as any;
          return {
            rows: row.rows || 0,
            dataSize: this.formatBytes(row.data_size || 0),
            indexSize: this.formatBytes(row.index_size || 0),
            totalSize: this.formatBytes(row.total_size || 0),
          };
        }
      }
      
      // 简化处理，返回默认值
      return {
        rows: 0,
        dataSize: 'N/A',
        indexSize: 'N/A',
        totalSize: 'N/A',
      };
    } catch (error) {
      logger.error(`Failed to get table size for ${tableName}:`, error);
      return null;
    }
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // ========== 查询解释和分析 ==========

  /**
   * 解释查询执行计划
   */
  async explainQuery(query: string): Promise<any[]> {
    try {
      const dialect = sequelize.getDialect();
      let explainQuery: string;

      if (dialect === 'mysql') {
        explainQuery = `EXPLAIN ${query}`;
      } else if (dialect === 'postgres') {
        explainQuery = `EXPLAIN (FORMAT JSON) ${query}`;
      } else if (dialect === 'sqlite') {
        explainQuery = `EXPLAIN QUERY PLAN ${query}`;
      } else {
        throw new Error(`Unsupported dialect: ${dialect}`);
      }

      const results = await sequelize.query(explainQuery, { type: QueryTypes.SELECT });
      return results;
    } catch (error) {
      logger.error('Failed to explain query:', error);
      return [];
    }
  }

  /**
   * 分析查询性能
   */
  async analyzeQuery(query: string): Promise<{
    executionTime: number;
    explainPlan: any[];
    recommendations: string[];
  }> {
    const startTime = Date.now();
    
    // 获取执行计划
    const explainPlan = await this.explainQuery(query);
    
    const executionTime = Date.now() - startTime;
    
    // 生成优化建议
    const recommendations = this.generateRecommendations(explainPlan, executionTime);

    return {
      executionTime,
      explainPlan,
      recommendations,
    };
  }

  /**
   * 生成优化建议
   */
  private generateRecommendations(explainPlan: any[], executionTime: number): string[] {
    const recommendations: string[] = [];
    
    if (executionTime > this.slowQueryThreshold) {
      recommendations.push('查询执行时间过长，建议优化');
    }
    
    // 检查是否使用了索引
    const planStr = JSON.stringify(explainPlan).toLowerCase();
    if (!planStr.includes('index') && !planStr.includes('key')) {
      recommendations.push('查询未使用索引，建议添加合适的索引');
    }
    
    if (planStr.includes('full table scan') || planStr.includes('all')) {
      recommendations.push('检测到全表扫描，建议添加索引');
    }
    
    if (planStr.includes('temporary')) {
      recommendations.push('查询使用了临时表，建议优化查询结构');
    }
    
    if (planStr.includes('filesort')) {
      recommendations.push('查询使用了文件排序，建议添加排序字段索引');
    }

    return recommendations;
  }

  // ========== 统计和报告 ==========

  /**
   * 生成数据库性能报告
   */
  async generatePerformanceReport(): Promise<string> {
    const poolStatus = await this.getPoolStatus();
    const queryStats = this.getQueryStatsSummary();
    const slowQueries = this.getSlowQueries(5);

    const report = `
# 数据库性能报告

## 连接池状态
- 活跃连接: ${poolStatus.active}
- 空闲连接: ${poolStatus.idle}
- 等待连接: ${poolStatus.waiting}
- 总连接数: ${poolStatus.total}

## 查询统计
- 总查询数: ${queryStats.totalQueries}
- 慢查询数: ${queryStats.slowQueries}
- 平均执行时间: ${queryStats.avgExecutionTime}ms
- 最大执行时间: ${queryStats.maxExecutionTime}ms
- 每秒查询数: ${queryStats.queriesPerSecond}

## 最近慢查询
${slowQueries.map((q, i) => `${i + 1}. ${q.query} (${q.executionTime}ms)`).join('\n') || '无'}

## 优化建议
- 连接池配置: max=${performanceConfig.database.pool.max}, min=${performanceConfig.database.pool.min}
- 慢查询阈值: ${this.slowQueryThreshold}ms
- 查询缓存: ${performanceConfig.database.queryOptimization.enableQueryCache ? '启用' : '禁用'}

---
报告生成时间: ${new Date().toISOString()}
`;

    return report;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.queryStats = [];
    logger.info('Database optimizer stats reset');
  }
}

// 创建全局数据库优化器实例
export const databaseOptimizer = new DatabaseOptimizer();

// 导出查询监控中间件
export function queryMonitoringMiddleware() {
  return async (query: string, executionTime: number, rowsAffected: number) => {
    databaseOptimizer.recordQuery(query, executionTime, rowsAffected);
  };
}

export default databaseOptimizer;