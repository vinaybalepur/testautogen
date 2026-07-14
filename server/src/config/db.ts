import { Pool } from 'pg';
import dotenv   from 'dotenv';

// Only load .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

console.log('DATABASE_URL:', process.env.DATABASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err: Error) => console.error('❌ DB connection error:', err));

export default pool;