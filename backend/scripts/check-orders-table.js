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
    logging: false,
  }
);

async function checkOrdersTable() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    // Check if orders table exists
    const [tables] = await sequelize.query('SHOW TABLES LIKE "orders"');
    console.log('Orders table exists:', tables.length > 0);

    if (tables.length > 0) {
      // Get table structure
      const [columns] = await sequelize.query('DESCRIBE orders');
      console.log('\nOrders table columns:');
      columns.forEach(col => {
        console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
      });

      // Check foreign keys
      const [foreignKeys] = await sequelize.query(`
        SELECT 
          COLUMN_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_NAME = 'orders' 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      console.log('\nForeign keys:');
      foreignKeys.forEach(fk => {
        console.log(`  ${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERenced_COLUMN_NAME}`);
      });

      // Count orders
      const [countResult] = await sequelize.query('SELECT COUNT(*) as count FROM orders');
      console.log('\nTotal orders:', countResult[0].count);
    }

    // Check related tables
    const relatedTables = ['auctions', 'products', 'users'];
    for (const table of relatedTables) {
      const [exists] = await sequelize.query(`SHOW TABLES LIKE "${table}"`);
      console.log(`${table} table exists:`, exists.length > 0);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await sequelize.close();
  }
}

checkOrdersTable();
