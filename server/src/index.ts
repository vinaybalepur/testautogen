import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import dotenv       from 'dotenv';

import authRoutes        from './routes/auth';
import jiraRoutes        from './routes/jira';
import aiRoutes          from './routes/ai';
import testCaseRoutes    from './routes/testCases';
import jiraPushRoutes    from './routes/jiraPush';
import postmanRoutes     from './routes/postman';
import newmanRoutes      from './routes/newman';
import defectRoutes      from './routes/defects';
import adminRoutes       from './routes/admin';
import tokenRoutes       from './routes/tokens';
import aiConfigRoutes    from './routes/aiConfig';
import discoveryRoutes   from './routes/discovery';
import apiRegistryRoutes from './routes/apiRegistry';
import securityRoutes    from './routes/security';
import performanceRoutes from './routes/performance';

import { securityPipeline } from './security/SecurityPipeline';
import pool from './config/db';
import './config/db';

dotenv.config();

const app = express();

// ── CORS ─────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost',
  'http://127.0.0.1',
  'http://127.0.0.1:5173',
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ── Security Pipeline (before all routes) ─────────────
// Covers: OWASP API1-10, Zero Trust HTTP layer,
// Rate limiting, Brute force, Anomaly detection,
// Security headers, Audit logging, IP blocking
app.use(securityPipeline);

// ── Routes ────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/jira',      jiraRoutes);
app.use('/api/ai',        aiRoutes);
app.use('/api/testcases', testCaseRoutes);
app.use('/api/push',      jiraPushRoutes);
app.use('/api/postman',   postmanRoutes);
app.use('/api/newman',    newmanRoutes);
app.use('/api/defects',   defectRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/tokens',    tokenRoutes);
app.use('/api/ai-config', aiConfigRoutes);
app.use('/api/discovery', discoveryRoutes);
app.use('/api/registry',  apiRegistryRoutes);
app.use('/api/security',  securityRoutes); 
app.use('/api/performance', performanceRoutes);

// ── Health check ──────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'Server is up and running 🚀' });
});

// ── Startup cleanup ───────────────────────────────────
const cleanupOldRuns = async (): Promise<void> => {
  try {
    const days = parseInt(process.env.REPORT_RETENTION_DAYS || '60');
    await pool.query(`DELETE FROM test_runs WHERE run_at < NOW() - INTERVAL '${days} days'`);
    console.log(`✅ Cleaned up old test runs (retention: ${days} days)`);
  } catch (err) {
    console.error('Startup cleanup error:', err);
  }
};

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔐 Security pipeline active`);
  await cleanupOldRuns();
});
