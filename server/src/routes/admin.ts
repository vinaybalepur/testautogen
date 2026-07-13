import { Router }                                                      from 'express';
import { getAllUsers, promoteToAdmin, demoteToUser, toggleUserStatus }  from '../controllers/adminController';
import authenticate                                                      from '../middleware/authenticate';
import isAdmin                                                           from '../middleware/isAdmin';

const router = Router();

// All admin routes require authentication + admin role
router.get('/users',                authenticate, isAdmin, getAllUsers);
router.put('/users/:userId/promote', authenticate, isAdmin, promoteToAdmin);
router.put('/users/:userId/demote',  authenticate, isAdmin, demoteToUser);
router.put('/users/:userId/toggle',  authenticate, isAdmin, toggleUserStatus);

export default router;