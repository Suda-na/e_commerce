const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ecommerce_ai',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: console.log,
  }
);

async function testOrderQuery() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Test the exact query that getOrders would run
    const [results, metadata] = await sequelize.query(`
      SELECT 
        o.id, o.auction_id, o.user_id, o.amount, o.status, 
        o.tracking_number, o.shipping_company, o.shipping_address,
        o.remark, o.merchant_remark, o.created_at, o.updated_at,
        a.id as auction_id_2, a.product_id, a.status as auction_status, 
        a.current_price, a.end_time,
        p.id as product_id_2, p.name as product_name, p.images,
        u.id as user_id_2, u.username, u.avatar
      FROM orders o
      LEFT JOIN auctions a ON o.auction_id = a.id
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.user_id = 1
      ORDER BY o.created_at DESC
      LIMIT 10 OFFSET 0
    `);

    console.log('\nQuery results:');
    console.log('Number of rows:', results.length);
    if (results.length > 0) {
      console.log('First row:', JSON.stringify(results[0], null, 2));
    }

    // Also test count
    const [countResult] = await sequelize.query(`
      SELECT COUNT(DISTINCT o.id) as count
      FROM orders o
      LEFT JOIN auctions a ON o.auction_id = a.id
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.user_id = 1
    `);
    console.log('\nCount result:', countResult[0].count);

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    if (error.original) {
      console.error('Original error:', error.original);
    }
  } finally {
    await sequelize.close();
  }
}

testOrderQuery();
