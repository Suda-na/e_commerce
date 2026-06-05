/**
 * 视频源配置管理工具
 * 
 * 支持4种视频源方案：
 * 1. 固定 MP4 循环播放（MVP 推荐）
 * 2. HLS 拉流（.m3u8）
 * 3. Canvas 模拟（无视频源时）
 * 4. live-player（真直播，需腾讯云）
 */

// ==================== 类型定义 ====================

/** 视频源类型 */
export enum VideoSourceType {
  /** 固定 MP4 循环播放 */
  MP4 = 'mp4',
  /** HLS 拉流 */
  HLS = 'hls',
  /** Canvas 模拟 */
  CANVAS = 'canvas',
  /** live-player 真直播 */
  LIVE_PLAYER = 'live-player',
}

/** 视频源配置 */
export interface VideoSourceConfig {
  /** 视频源类型 */
  type: VideoSourceType;
  /** 视频源地址 */
  src: string;
  /** 视频封面图 */
  poster?: string;
  /** 是否自动播放 */
  autoplay?: boolean;
  /** 是否循环播放 */
  loop?: boolean;
  /** 是否静音 */
  muted?: boolean;
  /** 视频标题 */
  title?: string;
  /** 额外配置 */
  extra?: Record<string, any>;
}

/** 视频播放状态 */
export interface VideoPlaybackState {
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否静音 */
  isMuted: boolean;
  /** 是否全屏 */
  isFullscreen: boolean;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 视频总时长（秒） */
  duration: number;
  /** 缓冲进度（0-1） */
  buffered: number;
  /** 播放错误信息 */
  error?: string;
}

// ==================== 默认配置 ====================

/** 默认 MP4 视频源 - 微信小程序实测可用，小文件快速加载 */
const DEFAULT_MP4_SOURCES = [
  'https://vjs.zencdn.net/v/oceans.mp4',
  'https://media.w3.org/2010/05/sintel/trailer.mp4',
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
];

/** 默认 HLS 视频源 - Apple/Akamai CDN，稳定可靠 */
const DEFAULT_HLS_SOURCES = [
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
  'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
];

/** 默认视频封面 - 使用空白图片 */
const DEFAULT_POSTER = '';

// ==================== 工具函数 ====================

/**
 * 创建 MP4 视频源配置
 * @param src 视频源地址（可选，使用默认源）
 * @param options 额外配置
 * @returns 视频源配置
 */
export const createMp4Source = (
  src?: string,
  options?: Partial<VideoSourceConfig>
): VideoSourceConfig => {
  const videoSrc = src || DEFAULT_MP4_SOURCES[Math.floor(Math.random() * DEFAULT_MP4_SOURCES.length)];
  
  return {
    type: VideoSourceType.MP4,
    src: videoSrc,
    poster: options?.poster || DEFAULT_POSTER,
    autoplay: options?.autoplay ?? true,
    loop: options?.loop ?? true,
    muted: options?.muted ?? false,
    title: options?.title || '直播竞拍',
    ...options,
  };
};

/**
 * 创建 HLS 视频源配置
 * @param src HLS 流地址
 * @param options 额外配置
 * @returns 视频源配置
 */
export const createHlsSource = (
  src?: string,
  options?: Partial<VideoSourceConfig>
): VideoSourceConfig => {
  const videoSrc = src || DEFAULT_HLS_SOURCES[Math.floor(Math.random() * DEFAULT_HLS_SOURCES.length)];
  
  return {
    type: VideoSourceType.HLS,
    src: videoSrc,
    poster: options?.poster || DEFAULT_POSTER,
    autoplay: options?.autoplay ?? true,
    loop: options?.loop ?? false,
    muted: options?.muted ?? false,
    title: options?.title || '直播竞拍',
    ...options,
  };
};

/**
 * 创建 Canvas 模拟视频源配置
 * @param options 额外配置
 * @returns 视频源配置
 */
export const createCanvasSource = (
  options?: Partial<VideoSourceConfig>
): VideoSourceConfig => {
  return {
    type: VideoSourceType.CANVAS,
    src: '',
    poster: options?.poster || DEFAULT_POSTER,
    autoplay: false,
    loop: false,
    muted: options?.muted ?? true,
    title: options?.title || '直播竞拍（模拟）',
    extra: {
      canvasWidth: 375,
      canvasHeight: 667,
      backgroundColor: '#000',
      text: '直播竞拍中...',
      textColor: '#fff',
      fontSize: 24,
      ...options?.extra,
    },
    ...options,
  };
};

/**
 * 创建 live-player 视频源配置
 * @param src 直播流地址
 * @param options 额外配置
 * @returns 视频源配置
 */
export const createLivePlayerSource = (
  src?: string,
  options?: Partial<VideoSourceConfig>
): VideoSourceConfig => {
  const videoSrc = src || 'rtmp://live.example.com/stream';
  
  return {
    type: VideoSourceType.LIVE_PLAYER,
    src: videoSrc,
    poster: options?.poster || DEFAULT_POSTER,
    autoplay: options?.autoplay ?? true,
    loop: false,
    muted: options?.muted ?? false,
    title: options?.title || '直播竞拍',
    extra: {
      mode: 'live',
      orientation: 'vertical',
      objectFit: 'contain',
      ...options?.extra,
    },
    ...options,
  };
};

/**
 * 根据视频源地址自动判断类型
 * @param src 视频源地址
 * @returns 视频源类型
 */
export const detectVideoSourceType = (src: string): VideoSourceType => {
  if (!src) {
    return VideoSourceType.CANVAS;
  }
  
  const lowerSrc = src.toLowerCase();
  
  // HLS 流
  if (lowerSrc.includes('.m3u8') || lowerSrc.includes('hls')) {
    return VideoSourceType.HLS;
  }
  
  // RTMP 流
  if (lowerSrc.startsWith('rtmp://') || lowerSrc.startsWith('rtmps://')) {
    return VideoSourceType.LIVE_PLAYER;
  }
  
  // 其他直播协议
  if (lowerSrc.startsWith('http://') || lowerSrc.startsWith('https://')) {
    // 检查是否是流媒体地址
    if (lowerSrc.includes('/live/') || lowerSrc.includes('/stream/')) {
      return VideoSourceType.LIVE_PLAYER;
    }
  }
  
  // 默认为 MP4
  return VideoSourceType.MP4;
};

/**
 * 根据视频源地址创建配置
 * @param src 视频源地址
 * @param options 额外配置
 * @returns 视频源配置
 */
export const createVideoSourceFromUrl = (
  src: string,
  options?: Partial<VideoSourceConfig>
): VideoSourceConfig => {
  const type = detectVideoSourceType(src);
  
  switch (type) {
    case VideoSourceType.HLS:
      return createHlsSource(src, options);
    case VideoSourceType.LIVE_PLAYER:
      return createLivePlayerSource(src, options);
    case VideoSourceType.CANVAS:
      return createCanvasSource(options);
    case VideoSourceType.MP4:
    default:
      return createMp4Source(src, options);
  }
};

/**
 * 创建默认视频源配置
 * @param type 视频源类型（可选，默认 MP4）
 * @param options 额外配置
 * @returns 视频源配置
 */
export const createDefaultVideoSource = (
  type?: VideoSourceType,
  options?: Partial<VideoSourceConfig>
): VideoSourceConfig => {
  const sourceType = type || VideoSourceType.MP4;
  
  switch (sourceType) {
    case VideoSourceType.HLS:
      return createHlsSource(undefined, options);
    case VideoSourceType.CANVAS:
      return createCanvasSource(options);
    case VideoSourceType.LIVE_PLAYER:
      return createLivePlayerSource(undefined, options);
    case VideoSourceType.MP4:
    default:
      return createMp4Source(undefined, options);
  }
};

/**
 * 验证视频源地址是否有效
 * @param src 视频源地址
 * @param type 视频源类型
 * @returns 是否有效
 */
export const validateVideoSource = (src: string, type?: VideoSourceType): boolean => {
  if (!src) {
    return type === VideoSourceType.CANVAS;
  }
  
  const sourceType = type || detectVideoSourceType(src);
  
  switch (sourceType) {
    case VideoSourceType.MP4:
      return src.startsWith('http') && (src.includes('.mp4') || src.includes('.webm') || src.includes('.ogg'));
    case VideoSourceType.HLS:
      return src.startsWith('http') && src.includes('.m3u8');
    case VideoSourceType.LIVE_PLAYER:
      return src.startsWith('rtmp://') || src.startsWith('rtmps://') || src.startsWith('http');
    case VideoSourceType.CANVAS:
      return true;
    default:
      return false;
  }
};

/**
 * 获取视频源类型的中文描述
 * @param type 视频源类型
 * @returns 中文描述
 */
export const getVideoSourceTypeLabel = (type: VideoSourceType): string => {
  const labelMap: Record<VideoSourceType, string> = {
    [VideoSourceType.MP4]: 'MP4 视频',
    [VideoSourceType.HLS]: 'HLS 直播流',
    [VideoSourceType.CANVAS]: 'Canvas 模拟',
    [VideoSourceType.LIVE_PLAYER]: '实时直播',
  };
  return labelMap[type] || '未知类型';
};

/**
 * 获取视频源类型的图标
 * @param type 视频源类型
 * @returns 图标名称
 */
export const getVideoSourceTypeIcon = (type: VideoSourceType): string => {
  const iconMap: Record<VideoSourceType, string> = {
    [VideoSourceType.MP4]: 'icon-video',
    [VideoSourceType.HLS]: 'icon-live',
    [VideoSourceType.CANVAS]: 'icon-canvas',
    [VideoSourceType.LIVE_PLAYER]: 'icon-live-stream',
  };
  return iconMap[type] || 'icon-video';
};

// ==================== 导出 ====================

export default {
  VideoSourceType,
  createMp4Source,
  createHlsSource,
  createCanvasSource,
  createLivePlayerSource,
  detectVideoSourceType,
  createVideoSourceFromUrl,
  createDefaultVideoSource,
  validateVideoSource,
  getVideoSourceTypeLabel,
  getVideoSourceTypeIcon,
};