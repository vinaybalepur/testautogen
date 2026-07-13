import { Router }           from 'express';
import {
  runCollection,
  getRunStatus,
  getCollectionRuns,
  getTicketRuns,
  getReport
}                           from '../controllers/newmanController';
import authenticate         from '../middleware/authenticate';

const router = Router();

// All routes are protected
router.post('/run/:collectionId',              authenticate, runCollection);
router.get('/runs/:runId',                     authenticate, getRunStatus);
router.get('/runs/:runId/report',              authenticate, getReport);
router.get('/collections/:collectionId/runs',  authenticate, getCollectionRuns);
router.get('/tickets/:ticketKey/runs',         authenticate, getTicketRuns);

export default router;