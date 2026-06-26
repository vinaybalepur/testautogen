import { Router }                                    from 'express';
import { register, login, refresh, logout, me }      from '../controllers/authController';
import authenticate                                   from '../middleware/authenticate';

const router = Router();

// Public routes — no authentication needed
router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refresh);

// Protected routes — authentication required
router.post('/logout',   authenticate, logout);
router.get('/me',        authenticate, me);

export default router;