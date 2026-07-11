import { Router }              from 'express';
import { pushTestCasesToJira } from '../controllers/jiraPushController';
import authenticate             from '../middleware/authenticate';

const router = Router();

router.post('/:ticketKey/push', authenticate, pushTestCasesToJira);

export default router;