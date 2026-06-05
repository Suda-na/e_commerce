import { sequelize } from '../src/config/database';
import { User, Product, Auction } from '../src/models';
import { logger } from '../src/utils/logger';
import bcrypt from 'bcryptjs';

// 种子数据脚本
async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');
    
    // 测试数据库连接
    await sequelize.authenticate();
    logger.info('Database connection established.');
    
    // 创建测试用户
    const users = await createTestUsers();
    
    // 创建测试商品
    const products = await createTestProducts(users);
    
    // 创建测试竞拍
    await createTestAuctions(products);
    
    logger.info('Database seeding completed successfully.');
    
    // 关闭数据库连接
    await sequelize.close();
    logger.info('Database connection closed.');
    
    process.exit(0);
  } catch (error) {
    logger.error('Database seeding failed:', error);
    process.exit(1);
  }
}

// 创建测试用户
async function createTestUsers(): Promise<any[]> {
  logger.info('Creating test users...');
  
  const salt = await bcrypt.genSalt(10);
  
  const usersData = [
    {
      username: 'merchant1',
      password: await bcrypt.hash('password123', salt),
      role: 'merchant' as const,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=merchant1',
    },
    {
      username: 'merchant2',
      password: await bcrypt.hash('password123', salt),
      role: 'merchant' as const,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=merchant2',
    },
    {
      username: 'merchant3',
      password: await bcrypt.hash('password123', salt),
      role: 'merchant' as const,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=merchant3',
    },
    {
      username: 'merchant4',
      password: await bcrypt.hash('password123', salt),
      role: 'merchant' as const,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=merchant4',
    },
    {
      username: 'merchant5',
      password: await bcrypt.hash('password123', salt),
      role: 'merchant' as const,
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=merchant5',
    },
    {
      username: 'user1',
      password: await bcrypt.hash('password123', salt),
      role: 'user' as const,
    },
    {
      username: 'user2',
      password: await bcrypt.hash('password123', salt),
      role: 'user' as const,
    },
    {
      username: 'user3',
      password: await bcrypt.hash('password123', salt),
      role: 'user' as const,
    },
  ];
  
  const users: any[] = [];
  for (const userData of usersData) {
    const [user, created] = await User.findOrCreate({
      where: { username: userData.username },
      defaults: userData,
    });
    
    if (created) {
      logger.info(`Created user: ${userData.username}`);
    } else {
      logger.info(`User already exists: ${userData.username}`);
    }
    
    users.push(user);
  }
  
  return users;
}

// 创建测试商品
async function createTestProducts(users: any[]): Promise<any[]> {
  logger.info('Creating test products...');
  
  const merchants = users.filter(u => u.role === 'merchant');
  
  const productsData = [
    {
      merchant_id: merchants[0].id,
      name: 'iPhone 15 Pro Max',
      description: '全新未拆封 iPhone 15 Pro Max 256GB 原色钛金属',
      images: ['https://picsum.photos/seed/iphone1/400/400', 'https://picsum.photos/seed/iphone2/400/400'],
      starting_price: 8000,
      price_increment: 100,
      duration: 300,
      cap_price: 12000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[0].id,
      name: 'MacBook Pro 14英寸',
      description: 'Apple MacBook Pro 14英寸 M3 Pro芯片 18GB内存 512GB固态硬盘',
      images: ['https://picsum.photos/seed/macbook1/400/400'],
      starting_price: 12000,
      price_increment: 200,
      duration: 600,
      cap_price: 18000,
      delay_time: 15,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[1].id,
      name: 'AirPods Pro 2',
      description: 'Apple AirPods Pro 第二代 主动降噪蓝牙耳机',
      images: ['https://picsum.photos/seed/airpods1/400/400'],
      starting_price: 1500,
      price_increment: 50,
      duration: 180,
      cap_price: 2000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[1].id,
      name: 'iPad Air 5',
      description: 'Apple iPad Air 5 10.9英寸 M1芯片 256GB WiFi版',
      images: ['https://picsum.photos/seed/ipad1/400/400'],
      starting_price: 4000,
      price_increment: 100,
      duration: 240,
      cap_price: 6000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[2].id,
      name: 'Samsung Galaxy S24 Ultra',
      description: '三星 Galaxy S24 Ultra 12GB+256GB 钛黑色 5G手机',
      images: ['https://picsum.photos/seed/samsung1/400/400'],
      starting_price: 7000,
      price_increment: 100,
      duration: 300,
      cap_price: 10000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[2].id,
      name: 'Sony WH-1000XM5',
      description: '索尼 WH-1000XM5 头戴式降噪蓝牙耳机 黑色',
      images: ['https://picsum.photos/seed/sony1/400/400'],
      starting_price: 2000,
      price_increment: 50,
      duration: 180,
      cap_price: 3000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[3].id,
      name: 'Nintendo Switch OLED',
      description: '任天堂 Switch OLED款 掌上游戏机 白色',
      images: ['https://picsum.photos/seed/switch1/400/400'],
      starting_price: 2500,
      price_increment: 50,
      duration: 240,
      cap_price: 3500,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[3].id,
      name: 'PS5 光驱版',
      description: '索尼 PlayStation 5 光驱版 国行游戏主机',
      images: ['https://picsum.photos/seed/ps5/400/400'],
      starting_price: 3500,
      price_increment: 100,
      duration: 300,
      cap_price: 5000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[4].id,
      name: 'DJI Mini 3 Pro',
      description: '大疆 DJI Mini 3 Pro 无人机 航拍飞行器',
      images: ['https://picsum.photos/seed/dji1/400/400'],
      starting_price: 4000,
      price_increment: 100,
      duration: 300,
      cap_price: 6000,
      delay_time: 10,
      status: 'pending' as const,
    },
    {
      merchant_id: merchants[4].id,
      name: 'Apple Watch Ultra 2',
      description: 'Apple Watch Ultra 2 钛金属表壳 橙色高山回环表带',
      images: ['https://picsum.photos/seed/watch1/400/400'],
      starting_price: 5000,
      price_increment: 100,
      duration: 240,
      cap_price: 7000,
      delay_time: 10,
      status: 'pending' as const,
    },
  ];
  
  const products: any[] = [];
  for (const productData of productsData) {
    const [product, created] = await Product.findOrCreate({
      where: { name: productData.name },
      defaults: productData,
    });
    
    if (created) {
      logger.info(`Created product: ${productData.name}`);
    } else {
      logger.info(`Product already exists: ${productData.name}`);
    }
    
    products.push(product);
  }
  
  return products;
}

// 创建测试竞拍
async function createTestAuctions(products: any[]) {
  logger.info('Creating test auctions...');
  
  for (const product of products) {
    const [auction, created] = await Auction.findOrCreate({
      where: { product_id: product.id },
      defaults: {
        product_id: product.id,
        status: 'pending',
      },
    });
    
    if (created) {
      logger.info(`Created auction for product: ${product.name}`);
    } else {
      logger.info(`Auction already exists for product: ${product.name}`);
    }
  }
}

// 运行种子数据
seedDatabase();