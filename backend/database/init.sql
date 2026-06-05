-- 直播竞拍全栈系统数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS auction_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE auction_db;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
  password VARCHAR(255) NOT NULL COMMENT '密码（加密）',
  role ENUM('merchant', 'user') NOT NULL DEFAULT 'user' COMMENT '角色',
  avatar VARCHAR(255) COMMENT '头像URL',
  email VARCHAR(100) COMMENT '邮箱',
  phone VARCHAR(20) COMMENT '手机号',
  status TINYINT NOT NULL DEFAULT 1 COMMENT '状态：0-禁用，1-启用',
  login_count INT NOT NULL DEFAULT 1 COMMENT '登录次数',
  -- 收货地址字段
  receiver_name VARCHAR(50) COMMENT '收货人姓名',
  receiver_phone VARCHAR(20) COMMENT '收货人手机号',
  province VARCHAR(50) COMMENT '省份',
  city VARCHAR(50) COMMENT '城市',
  district VARCHAR(50) COMMENT '区/县',
  detail_address VARCHAR(255) COMMENT '详细地址',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 创建商品分类表
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  name VARCHAR(50) NOT NULL COMMENT '分类名称',
  icon VARCHAR(255) COMMENT '分类图标',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序值（越小越靠前）',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE INDEX idx_categories_merchant_name (merchant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品分类表';

-- 创建运费模板表（必须在 products 之前创建）
CREATE TABLE IF NOT EXISTS shipping_templates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  name VARCHAR(100) NOT NULL COMMENT '模板名称',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_merchant_id (merchant_id),
  CONSTRAINT fk_shipping_template_merchant FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='运费模板表';

-- 创建运费规则表
CREATE TABLE IF NOT EXISTS shipping_rules (
  id BIGINT NOT NULL AUTO_INCREMENT,
  template_id BIGINT NOT NULL COMMENT '模板ID',
  regions JSON NOT NULL COMMENT '配送区域 ["浙江省", "江苏省"]',
  first_item_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '首件费用',
  additional_item_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '续件费用',
  free_threshold DECIMAL(10,2) DEFAULT NULL COMMENT '免运费门槛(订单金额达到此值免运费)',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_template_id (template_id),
  CONSTRAINT fk_shipping_rule_template FOREIGN KEY (template_id) REFERENCES shipping_templates(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='运费规则表';

-- 创建商品表
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  name VARCHAR(100) NOT NULL COMMENT '商品名称',
  description TEXT COMMENT '商品描述',
  images JSON COMMENT '商品图片列表',
  starting_price DECIMAL(10,2) NOT NULL COMMENT '起拍价',
  price_increment DECIMAL(10,2) NOT NULL COMMENT '加价幅度',
  duration INT NOT NULL COMMENT '竞拍时长（秒）',
  cap_price DECIMAL(10,2) COMMENT '封顶价',
  delay_time INT NOT NULL DEFAULT 10 COMMENT '延时时间（秒）',
  status ENUM('pending', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  category_id INT COMMENT '分类ID',
  tags JSON COMMENT '标签列表',
  stock INT NOT NULL DEFAULT 1 COMMENT '库存数量',
  stock_warning INT NOT NULL DEFAULT 5 COMMENT '库存预警阈值',
  sku VARCHAR(50) COMMENT 'SKU编码',
  weight DECIMAL(10,2) COMMENT '重量(kg)',
  shipping_template_id BIGINT DEFAULT NULL COMMENT '运费模板ID',
  specifications JSON COMMENT '规格参数 {"颜色": "红色", "尺寸": "XL"}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE SET NULL,
  FOREIGN KEY (shipping_template_id) REFERENCES shipping_templates(id) ON DELETE SET NULL ON UPDATE SET NULL,
  INDEX idx_merchant_id (merchant_id),
  INDEX idx_status (status),
  INDEX idx_name (name),
  INDEX idx_category_id (category_id),
  INDEX idx_stock (stock),
  UNIQUE INDEX idx_sku (sku),
  INDEX idx_shipping_template_id (shipping_template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

-- 创建竞拍记录表
CREATE TABLE IF NOT EXISTS auctions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL COMMENT '商品ID',
  start_time TIMESTAMP NULL COMMENT '开始时间',
  end_time TIMESTAMP NULL COMMENT '结束时间',
  current_price DECIMAL(10,2) COMMENT '当前价格',
  winner_id BIGINT COMMENT '获胜者ID',
  status ENUM('pending', 'active', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE SET NULL,
  INDEX idx_product_id (product_id),
  INDEX idx_winner_id (winner_id),
  INDEX idx_status (status),
  INDEX idx_start_time (start_time),
  INDEX idx_end_time (end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='竞拍记录表';

-- 创建出价记录表
CREATE TABLE IF NOT EXISTS bids (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  auction_id BIGINT NOT NULL COMMENT '竞拍ID',
  user_id BIGINT NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '出价金额',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_auction_id (auction_id),
  INDEX idx_user_id (user_id),
  INDEX idx_auction_user (auction_id, user_id),
  INDEX idx_amount (amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='出价记录表';

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  auction_id BIGINT NOT NULL COMMENT '竞拍ID',
  user_id BIGINT NOT NULL COMMENT '用户ID（买家）',
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
  status ENUM('pending', 'paid', 'shipped', 'refunding', 'refunded', 'cancelled') NOT NULL DEFAULT 'pending',
  tracking_number VARCHAR(100) COMMENT '快递单号',
  shipping_company VARCHAR(100) COMMENT '物流公司',
  shipping_address TEXT COMMENT '收货地址',
  receiver_name VARCHAR(50) COMMENT '收货人姓名',
  receiver_phone VARCHAR(20) COMMENT '收货人手机号',
  remark TEXT COMMENT '买家备注',
  merchant_remark TEXT COMMENT '商家内部备注',
  refund_reason TEXT COMMENT '退款原因',
  refund_rejected_reason TEXT COMMENT '拒绝退款原因',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_auction_id (auction_id),
  INDEX idx_user_id (user_id),
  INDEX idx_merchant_id (merchant_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 创建页面浏览记录表
CREATE TABLE IF NOT EXISTS page_views (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT NOT NULL COMMENT '商品ID',
  user_id BIGINT NULL COMMENT '用户ID（可选，未登录为NULL）',
  session_id VARCHAR(128) NOT NULL COMMENT '会话ID（用于匿名用户追踪）',
  ip_address VARCHAR(45) NOT NULL COMMENT '客户端IP地址',
  user_agent TEXT NOT NULL COMMENT '浏览器/设备信息',
  referrer TEXT NULL COMMENT '来源页面URL',
  page_type ENUM('product', 'auction', 'live') NOT NULL DEFAULT 'product' COMMENT '页面类型',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_page_views_product_id (product_id),
  INDEX idx_page_views_user_id (user_id),
  INDEX idx_page_views_created_at (created_at),
  INDEX idx_page_views_product_created (product_id, created_at),

  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='页面浏览记录表';

-- 创建收藏表（用户收藏商家）
CREATE TABLE IF NOT EXISTS favorites (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  merchant_id BIGINT NOT NULL COMMENT '商家ID',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE INDEX idx_favorites_user_merchant (user_id, merchant_id),
  INDEX idx_favorites_user_id (user_id),
  INDEX idx_favorites_merchant_id (merchant_id),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (merchant_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收藏表（用户收藏商家）';

-- 创建通知表
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL COMMENT '用户ID',
  type ENUM(
    'new_order', 'order_paid', 'refund_request',
    'auction_ending_soon', 'auction_ended', 'auction_won',
    'outbid', 'stock_warning', 'system_announcement',
    'auction_cancelled'
  ) NOT NULL COMMENT '通知类型',
  title VARCHAR(200) NOT NULL COMMENT '通知标题',
  message TEXT NOT NULL COMMENT '通知内容',
  priority ENUM('high', 'medium', 'low') NOT NULL DEFAULT 'medium' COMMENT '优先级',
  link VARCHAR(500) COMMENT '跳转链接',
  is_read TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已读：0-未读，1-已读',
  metadata JSON COMMENT '附加元数据',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read),
  INDEX idx_notifications_user_created (user_id, created_at),
  INDEX idx_notifications_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='通知表';
