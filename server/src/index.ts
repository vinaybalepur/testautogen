import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import dotenv       from 'dotenv';
import authRoutes   from './routes/auth';
import jiraRoutes  from './routes/jira';  
import aiRoutes     from './routes/ai';
import testCaseRoutes  from './routes/testCases'; 
import jiraPushRoutes  from './routes/jiraPush'; 
import postmanRoutes    from './routes/postman'; 
import newmanRoutes   from './routes/newman'; 
import pool             from './config/db';
import defectRoutes    from './routes/defects'; 
import adminRoutes from './routes/admin';
import tokenRoutes  from './routes/tokens';  
import aiConfigRoutes from './routes/aiConfig'; 
import discoveryRoutes from './routes/discovery'; 
import apiRegistryRoutes from './routes/apiRegistry';

import  './config/db';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin:      process.env.CLIENT_URL,
  credentials: true        // Required for cookies to work cross-origin
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/jira', jiraRoutes); 
app.use('/api/ai',   aiRoutes);

app.use('/api/jira', jiraRoutes); 
app.use('/api/ai',   aiRoutes);
app.use('/api/testcases',  testCaseRoutes); 
app.use('/api/push',       jiraPushRoutes);
app.use('/api/postman',   postmanRoutes);
app.use('/api/newman',    newmanRoutes);  
app.use('/api/defects',   defectRoutes); 
app.use('/api/admin', adminRoutes); 
app.use('/api/tokens',    tokenRoutes); 
app.use('/api/ai-config', aiConfigRoutes); 
app.use('/api/discovery', discoveryRoutes);
app.use('/api/registry', apiRegistryRoutes); 


// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'Server is up and running 🚀' });
});

// ── Cleanup old test runs on startup ──────────────────
const cleanupOldRuns = async (): Promise<void> => {
  try {
    const retentionDays = parseInt(process.env.REPORT_RETENTION_DAYS || '60');
    const result = await pool.query(
      `DELETE FROM test_runs
       WHERE run_at < NOW() - INTERVAL '${retentionDays} days'`
    );
    console.log(`✅ Cleaned up old test runs (retention: ${retentionDays} days)`);
  } catch (err) {
    console.error('Startup cleanup error:', err);
  }
};

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

});

