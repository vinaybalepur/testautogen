import { Router }             from 'express';
import { generateCollection } from '../controllers/postmanController';
import authenticate            from '../middleware/authenticate';

const router = Router();

router.post('/generate', authenticate, generateCollection);

export default router;