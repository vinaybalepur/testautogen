import { Router }     from 'express';
import { getTicket }  from '../controllers/jiraController';
import authenticate   from '../middleware/authenticate';

const router = Router();

// All Jira routes are protected
router.get('/:ticketKey', authenticate, getTicket);

export default router;