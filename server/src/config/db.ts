import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  // Force it to a string to fix the SASL/SCRAM error
  password: String(process.env.DB_PASSWORD), 
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err: Error) => console.error('❌ DB connection error:', err));

export default pool;