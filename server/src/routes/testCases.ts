import { Router }           from 'express';
import {
  getTestCases,
  approveTestCase,
  approveAllTestCases,
  rejectTestCase,
  updateTestCase,
  downloadTestCases,
  deleteTestCase,
  uploadTestCases
}                           from '../controllers/testCaseController';
import authenticate         from '../middleware/authenticate';

const router = Router();

// Specific routes FIRST
router.get('/:ticketKey/download',     authenticate, downloadTestCases);
router.post('/:ticketKey/upload',      authenticate, uploadTestCases);
router.put('/:ticketKey/approve-all',  authenticate, approveAllTestCases);

// Dynamic ID routes LAST
router.get('/:ticketKey',              authenticate, getTestCases);
router.put('/:id/approve',             authenticate, approveTestCase);
router.put('/:id/reject',              authenticate, rejectTestCase);
router.put('/:id',                     authenticate, updateTestCase);
router.delete('/:id',                  authenticate, deleteTestCase);

export default router;