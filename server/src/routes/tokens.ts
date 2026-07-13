import { Router }                                      from 'express';
import { getMyTokenUsage, getAllUsersTokenUsage }       from '../controllers/tokenController';
import authenticate                                     from '../middleware/authenticate';
import isAdmin                                          from '../middleware/isAdmin';

const router = Router();

// Own token usage — any logged in user
router.get('/my',  authenticate,          getMyTokenUsage);

// All users token usage — admin only
router.get('/all', authenticate, isAdmin, getAllUsersTokenUsage);

export default router;