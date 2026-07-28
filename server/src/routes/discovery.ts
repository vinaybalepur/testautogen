import { Router }                              from 'express';
import { runDiscovery, getDiscoveryStatus }    from '../controllers/discoveryController';
import authenticate                            from '../middleware/authenticate';
import isAdmin                                 from '../middleware/isAdmin';

const router = Router();

router.post('/:ticketKey/run',   authenticate, isAdmin, runDiscovery);
router.get('/:ticketKey/status', authenticate,          getDiscoveryStatus);

export default router;