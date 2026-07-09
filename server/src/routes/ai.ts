import { Router }                            from 'express';
import { generateTestCases }   from '../controllers/aiController';
import authenticate                           from '../middleware/authenticate';

const router = Router();

// All AI routes are protected
router.post('/generate', authenticate, generateTestCases);

export default router;