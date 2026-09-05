import { Router } from 'express';
import {
  runPerformanceTest,
  getPerformanceRunStatus,
  getPerformanceRunsByTicket,
} from '../controllers/performanceController';
import authenticate from '../middleware/authenticate';

const router = Router();

router.post('/run/:collectionId',       authenticate, runPerformanceTest);
router.get('/runs/:runId',              authenticate, getPerformanceRunStatus);
router.get('/tickets/:ticketKey/runs',  authenticate, getPerformanceRunsByTicket);

export default router;
