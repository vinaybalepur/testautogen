import { Router }                                                    from 'express';
import { createDefectFromFailure, getDefectsByTicket, getDefectsByRun } from '../controllers/defectController';
import authenticate                                                   from '../middleware/authenticate';

const router = Router();

// All routes are protected
router.post('/',                        authenticate, createDefectFromFailure);
router.get('/ticket/:ticketKey',        authenticate, getDefectsByTicket);
router.get('/run/:runId',               authenticate, getDefectsByRun);

export default router;