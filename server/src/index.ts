import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import dotenv       from 'dotenv';
import './config/db';
import authRoutes   from './routes/auth';

import jiraRoutes  from './routes/jira';  
import aiRoutes     from './routes/ai';
import testCaseRoutes  from './routes/testCases'; 
import jiraPushRoutes  from './routes/jiraPush'; 

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
app.use('/api/testcases',  testCaseRoutes); 
app.use('/api/push',       jiraPushRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'Server is up and running 🚀' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

});

