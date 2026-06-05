/**
 * 网络请求封装工具类
 * 
 * 功能特性：
 * 1. 统一 baseURL 配置（支持环境切换）
 * 2. 自动注入 Authorization Token
 * 3. 请求/响应拦截器
 * 4. 统一错误处理（401跳转登录、网络异常提示）
 * 5. Loading 状态管理（自动显示/隐藏）
 * 6. 请求取消（页面切换时取消未完成请求）
 * 7. 请求日志（开发环境）
 * 8. 失败重试机制
 */

// ==================== 配置 ====================

interface RequestConfig {
  baseURL: string;
  timeout: number;
  header?: Record<string, string>;
}

/** 开发环境配置 */
const DEV_CONFIG: RequestConfig = {
  baseURL: 'http://127.0.0.1:3001/api',
  timeout: 15000,
};

/** 生产环境配置 */
const PROD_CONFIG: RequestConfig = {
  baseURL: 'https://your-production-domain.com/api',
  timeout: 15000,
};

/** 体验版配置 */
const TRIAL_CONFIG: RequestConfig = {
  baseURL: 'https://your-trial-domain.com/api',
  timeout: 15000,
};

/** 根据环境获取配置 */
function getConfig(): RequestConfig {
  try {
    // 获取当前账号信息来判断环境
    const accountInfo = wx.getAccountInfoSync();
    const envVersion = accountInfo.miniProgram.envVersion;

    switch (envVersion) {
      case 'develop':
        return DEV_CONFIG;
      case 'trial':
        return TRIAL_CONFIG;
      case 'release':
        return PROD_CONFIG;
      default:
        return DEV_CONFIG;
    }
  } catch (e) {
    // 如果获取失败，默认使用开发配置
    return DEV_CONFIG;
  }
}

// ==================== 类型定义 ====================

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  data?: any;
  header?: Record<string, string>;
  showLoading?: boolean;
  loadingText?: string;
  showError?: boolean;
  isAuth?: boolean;
  retryCount?: number;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  success?: boolean;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    requestId?: string;
    timestamp?: string;
  };
}

type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// ==================== Token 管理 ====================

const TOKEN_KEY = 'token';
const USER_INFO_KEY = 'userInfo';

/** 获取 Token */
function getToken(): string | null {
  try {
    const app = getApp<IAppOption>();
    // 优先从 globalData 获取
    if (app.globalData.token) {
      return app.globalData.token;
    }
    // 其次从 Storage 获取
    return wx.getStorageSync(TOKEN_KEY) || null;
  } catch (e) {
    console.error('[Request] Get token failed:', e);
    return null;
  }
}

/** 设置 Token */
function setToken(token: string): void {
  try {
    const app = getApp<IAppOption>();
    app.globalData.token = token;
    app.globalData.isLoggedIn = true;
    wx.setStorageSync(TOKEN_KEY, token);
  } catch (e) {
    console.error('[Request] Set token failed:', e);
  }
}

/** 移除 Token */
function removeToken(): void {
  try {
    const app = getApp<IAppOption>();
    app.globalData.token = '';
    app.globalData.isLoggedIn = false;
    wx.removeStorageSync(TOKEN_KEY);
  } catch (e) {
    console.error('[Request] Remove token failed:', e);
  }
}

// ==================== 请求队列管理 ====================

/** 存储当前活跃的请求任务 */
const activeRequests: Map<string, WechatMiniprogram.RequestTask> = new Map();

/** 请求计数器（用于生成唯一 key） */
let requestCounter = 0;

/** 添加请求到队列 */
function addRequest(key: string, task: WechatMiniprogram.RequestTask): void {
  activeRequests.set(key, task);
}

/** 从队列移除请求 */
function removeRequest(key: string): void {
  activeRequests.delete(key);
}

/** 取消所有请求 */
function cancelAllRequests(): void {
  activeRequests.forEach((task, key) => {
    try {
      task.abort();
    } catch (e) {
      // 忽略取消失败的错误
    }
  });
  activeRequests.clear();
}

/** 取消指定页面的请求（根据 URL 前缀） */
function cancelRequestsByPrefix(prefix: string): void {
  activeRequests.forEach((task, key) => {
    if (key.startsWith(prefix)) {
      try {
        task.abort();
      } catch (e) {
        // 忽略
      }
      activeRequests.delete(key);
    }
  });
}

// ==================== 日志工具 ====================

/** 是否为开发环境 */
function isDevEnv(): boolean {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo.miniProgram.envVersion === 'develop';
  } catch (e) {
    return false;
  }
}

/** 请求日志 */
function logRequest(method: string, url: string, data?: any): void {
  if (isDevEnv()) {
    console.log(
      `%c[Request] ${method} ${url}`,
      'color: #1890FF; font-weight: bold;',
      data || ''
    );
  }
}

/** 响应日志 */
function logResponse(method: string, url: string, statusCode: number, data: any): void {
  if (isDevEnv()) {
    const color = statusCode >= 200 && statusCode < 300 ? '#52C41A' : '#FF4D4F';
    console.log(
      `%c[Response] ${method} ${url} [${statusCode}]`,
      `color: ${color}; font-weight: bold;`,
      data
    );
  }
}

/** 错误日志 */
function logError(method: string, url: string, error: any): void {
  if (isDevEnv()) {
    console.error(
      `%c[Error] ${method} ${url}`,
      'color: #FF4D4F; font-weight: bold;',
      error
    );
  }
}

/** 上报接口错误到全局错误监控 */
function reportApiError(method: string, url: string, statusCode: number | undefined, error: any): void {
  try {
    const app = getApp<IAppOption>();
    if (app && typeof app.reportError === 'function') {
      const message = error instanceof Error ? error.message : String(error);
      app.reportError({
        type: 'api_error',
        message: `[${method}] ${url} ${statusCode ? `[${statusCode}]` : ''}: ${message}`,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: Date.now()
      });
    }
  } catch (e) {
    // 上报失败不能影响正常流程
  }
}

// ==================== 核心请求函数 ====================

/**
 * 发起 HTTP 请求
 * @param options 请求选项
 * @returns Promise<ApiResponse<T>>
 */
function doRequest<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const {
      url,
      method = 'GET',
      data,
      header = {},
      showLoading = false,
      loadingText = '加载中...',
      showError = true,
      isAuth = true,
      retryCount = 0,
    } = options;

    // 1. 生成请求 key
    const requestKey = `${method}_${url}_${++requestCounter}`;

    // 2. 显示 Loading
    if (showLoading) {
      wx.showLoading({
        title: loadingText,
        mask: true,
      });
    }

    // 3. 构建请求头
    const finalHeader: Record<string, string> = {
      'Content-Type': 'application/json',
      ...header,
    };

    // 4. 注入 Token（如果需要认证）
    if (isAuth) {
      const token = getToken();
      console.log('[Request] Token注入:', token ? '有token' : '无token')
      if (token) {
        finalHeader['Authorization'] = `Bearer ${token}`;
      }
    }

    // 5. 构建完整 URL
    const fullUrl = url.startsWith('http') ? url : `${config.baseURL}${url}`;

    // 6. 打印请求日志
    logRequest(method, fullUrl, data);

    // 7. 发起请求
    const task = wx.request({
      url: fullUrl,
      method: method as WechatMiniprogram.RequestOption['method'],
      data,
      header: finalHeader,
      timeout: config.timeout,

      success: (res) => {
        // 隐藏 Loading
        if (showLoading) {
          wx.hideLoading();
        }

        const statusCode = res.statusCode;
        const responseData = res.data as ApiResponse<T>;

        // 打印响应日志
        logResponse(method, fullUrl, statusCode, responseData);

        // 处理不同的状态码
        if (statusCode >= 200 && statusCode < 300) {
          // 成功响应
          resolve(responseData);
        } else if (statusCode === 401) {
          // 401 未授权 → 清除 Token 并跳转登录
          handleUnauthorized();
          reject(new Error('未授权，请重新登录'));
        } else if (statusCode === 403) {
          // 403 禁止访问
          if (showError) {
            wx.showToast({
              title: '没有权限访问',
              icon: 'none',
              duration: 2000,
            });
          }
          reject(new Error('权限不足'));
        } else if (statusCode === 404) {
          // 404 资源不存在
          if (showError) {
            wx.showToast({
              title: '请求的资源不存在',
              icon: 'none',
              duration: 2000,
            });
          }
          reject(new Error('资源不存在'));
        } else if (statusCode >= 500) {
          // 5xx 服务器错误 → 尝试重试
          if (retryCount > 0) {
            console.warn(`[Request] 服务器错误，${retryCount}次重试机会剩余`);
            doRequest<T>({
              ...options,
              retryCount: retryCount - 1,
            }).then(resolve).catch(reject);
          } else {
            // 上报服务器错误
            reportApiError(method, fullUrl, statusCode, new Error(`服务器错误: ${statusCode}`));
            if (showError) {
              wx.showToast({
                title: '服务器繁忙，请稍后重试',
                icon: 'none',
                duration: 2000,
              });
            }
            reject(new Error(`服务器错误: ${statusCode}`));
          }
        } else {
          // 其他错误
          const errorMsg = responseData?.message || responseData?.error || `请求失败(${statusCode})`;
          if (showError) {
            wx.showToast({
              title: errorMsg,
              icon: 'none',
              duration: 2000,
            });
          }
          reject(new Error(errorMsg));
        }
      },

      fail: (err) => {
        // 隐藏 Loading
        if (showLoading) {
          wx.hideLoading();
        }

        // 打印错误日志
        logError(method, fullUrl, err);

        // 处理不同类型的失败
        let errorMessage = '网络异常，请检查网络连接';

        if (err.errMsg.includes('timeout')) {
          errorMessage = '请求超时，请稍后重试';
          // 超时也支持重试
          if (retryCount > 0) {
            console.warn(`[Request] 请求超时，${retryCount}次重试机会剩余`);
            doRequest<T>({
              ...options,
              retryCount: retryCount - 1,
            }).then(resolve).catch(reject);
            return;
          }
        } else if (err.errMsg.includes('abort')) {
          errorMessage = '请求已取消';
        } else if (err.errMsg.includes('fail url not in domain list')) {
          errorMessage = '请求地址不在白名单中';
          console.error('[Request] 请检查小程序后台配置的 request 合法域名');
        }

        // 上报错误到全局监控（取消的请求不上报）
        if (!err.errMsg.includes('abort')) {
          reportApiError(method, fullUrl, undefined, new Error(errorMessage));
        }

        if (showError && !err.errMsg.includes('abort')) {
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 2000,
          });
        }

        reject(new Error(errorMessage));
      },

      complete: () => {
        // 从请求队列中移除
        removeRequest(requestKey);
      },
    });

    // 8. 将任务加入队列
    addRequest(requestKey, task);
  });
}

// ==================== 快捷方法 ====================

/** GET 请求 */
function get<T = any>(url: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
  return doRequest<T>({ url, method: 'GET', data, ...options });
}

/** POST 请求 */
function post<T = any>(url: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
  return doRequest<T>({ url, method: 'POST', data, ...options });
}

/** PUT 请求 */
function put<T = any>(url: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
  return doRequest<T>({ url, method: 'PUT', data, ...options });
}

/** DELETE 请求 */
function del<T = any>(url: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
  return doRequest<T>({ url, method: 'DELETE', data, ...options });
}

/** PATCH 请求 */
function patch<T = any>(url: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
  return doRequest<T>({ url, method: 'PATCH', data, ...options });
}

// ==================== 错误处理 ====================

/**
 * 处理 401 未授权错误
 */
function handleUnauthorized(): void {
  // 1. 清除 Token 和用户信息
  removeToken();

  try {
    const app = getApp<IAppOption>();
    app.globalData.userInfo = null;
    app.globalData.isLoggedIn = false;
    wx.removeStorageSync(USER_INFO_KEY);
  } catch (e) {
    // 忽略
  }

  // 2. 显示提示
  wx.showToast({
    title: '登录已过期，请重新登录',
    icon: 'none',
    duration: 2000,
  });

  // 3. 延迟跳转到登录页（避免 showToast 被打断）
  setTimeout(() => {
    wx.redirectTo({
      url: '/pages/login/login',
    });
  }, 1500);
}

// ==================== 工具函数 ====================

/**
 * 上传文件
 * @param url 上传地址（相对路径）
 * @param filePath 本地文件路径
 * @param name 文件对应的 key
 * @param formData 额外的表单数据
 * @param showLoading 是否显示 loading
 */
function uploadFile<T = any>(
  url: string,
  filePath: string,
  name?: string,
  formData?: Record<string, any>,
  showLoading?: boolean
): Promise<ApiResponse<T>> {
  const n = name || 'file';
  const loading = showLoading !== undefined ? showLoading : true;
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const token = getToken();
    const fullUrl = url.startsWith('http') ? url : `${config.baseURL}${url}`;

    if (loading) {
      wx.showLoading({ title: '上传中...', mask: true });
    }

    const task = wx.uploadFile({
      url: fullUrl,
      filePath,
      name: n,
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      success: (res) => {
        if (showLoading) {
          wx.hideLoading();
        }

        if (res.statusCode === 200) {
          try {
            const data = JSON.parse(res.data) as ApiResponse<T>;
            resolve(data);
          } catch (e) {
            reject(new Error('解析响应数据失败'));
          }
        } else if (res.statusCode === 401) {
          handleUnauthorized();
          reject(new Error('未授权，请重新登录'));
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        if (showLoading) {
          wx.hideLoading();
        }
        wx.showToast({ title: '上传失败', icon: 'none' });
        reject(err);
      },
    });
  });
}

/**
 * 下载文件
 * @param url 下载地址
 * @param showLoading 是否显示 loading
 */
function downloadFile(
  url: string,
  showLoading?: boolean
): Promise<string> {
  const loading = showLoading !== undefined ? showLoading : true;
  return new Promise((resolve, reject) => {
    const config = getConfig();
    const token = getToken();
    const fullUrl = url.startsWith('http') ? url : `${config.baseURL}${url}`;

    if (loading) {
      wx.showLoading({ title: '下载中...', mask: true });
    }

    wx.downloadFile({
      url: fullUrl,
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      success: (res) => {
        if (showLoading) {
          wx.hideLoading();
        }

        if (res.statusCode === 200) {
          resolve(res.tempFilePath);
        } else {
          reject(new Error(`下载失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        if (showLoading) {
          wx.hideLoading();
        }
        wx.showToast({ title: '下载失败', icon: 'none' });
        reject(err);
      },
    });
  });
}

// ==================== 导出 ====================

/**
 * Request 类（保持向后兼容）
 */
class Request {
  /** GET 请求 */
  get = get;

  /** POST 请求 */
  post = post;

  /** PUT 请求 */
  put = put;

  /** DELETE 请求 */
  delete = del;

  /** PATCH 请求 */
  patch = patch;

  /** 上传文件 */
  upload = uploadFile;

  /** 下载文件 */
  download = downloadFile;

  /** 取消所有请求 */
  cancelAll = cancelAllRequests;

  /** 取消指定前缀的请求 */
  cancelByPrefix = cancelRequestsByPrefix;
}

/** 导出 Request 实例（保持向后兼容） */
export const request = new Request();

/** 导出独立函数（可按需使用） */
export {
  doRequest as httpRequest,
  get,
  post,
  put,
  del as delete,
  patch,
  uploadFile as upload,
  downloadFile as download,
  getToken,
  setToken,
  removeToken,
  cancelAllRequests,
  cancelRequestsByPrefix,
};

/** 默认导出 */
export default request;
