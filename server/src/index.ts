import express      from 'express';
import cors         from 'cors';
import cookieParser from 'cookie-parser';
import dotenv       from 'dotenv';
import './config/db';
import authRoutes   from './routes/auth';

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

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'Server is up and running 🚀' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});