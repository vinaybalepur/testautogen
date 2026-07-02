import { Router }                            from 'express';
import { generateTestCases, getTestCases }   from '../controllers/aiController';
import authenticate                           from '../middleware/authenticate';

const router = Router();

// All AI routes are protected
router.post('/generate',          authenticate, generateTestCases);
router.get('/testcases/:ticketKey', authenticate, getTestCases);

export default router;