import { Router }                                                                from 'express';
import { generateCollection, getCollections, getCollection, downloadCollection } from '../controllers/postmanController';
import authenticate                                                               from '../middleware/authenticate';

const router = Router();

// Specific routes FIRST
router.post('/generate',               authenticate, generateCollection);
router.get('/collection/:id/download', authenticate, downloadCollection);
router.get('/collection/:id',          authenticate, getCollection);

// Dynamic routes LAST
router.get('/:ticketKey',              authenticate, getCollections);

export default router;