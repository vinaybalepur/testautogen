import { Router }          from 'express';
import {
  getTestCases,
  approveTestCase,
  rejectTestCase,
  updateTestCase,
  downloadTestCases,
  deleteTestCase
}                           from '../controllers/testCaseController';
import authenticate         from '../middleware/authenticate';

const router = Router();

// All routes are protected
router.get('/:ticketKey',          authenticate, getTestCases);
router.get('/:ticketKey/download', authenticate, downloadTestCases);
router.put('/:id/approve',         authenticate, approveTestCase);
router.put('/:id/reject',          authenticate, rejectTestCase);
router.put('/:id',                 authenticate, updateTestCase);
router.delete('/:id',              authenticate, deleteTestCase);

export default router;