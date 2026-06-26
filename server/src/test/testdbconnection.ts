import pool from '../config/db';

const testConnection = async () => {
  try {
    console.log(pool)
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ DB connected successfully!');
    console.log('🕐 DB Server Time:', result.rows[0].current_time);
    process.exit(0);
  } catch (err) {
    console.error('❌ DB connection failed:', err);
    process.exit(1);
  }
};

testConnection();