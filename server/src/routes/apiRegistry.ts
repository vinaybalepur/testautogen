import { Router }                                                          from 'express';
import {
  getAPIs,
  createAPI,
  updateAPI,
  deleteAPI,
  importFromPostman,
  saveVariable,
  getVariables
}                                                                          from '../controllers/apiRegistryController';
import authenticate                                                        from '../middleware/authenticate';
import isAdmin                                                             from '../middleware/isAdmin';

const router = Router();

// All users
router.get('/',                     authenticate,          getAPIs);
router.get('/:apiId/variables',     authenticate,          getVariables);
router.post('/:apiId/variables',    authenticate,          saveVariable);

// Admin only
router.post('/',                    authenticate, isAdmin, createAPI);
router.put('/:id',                  authenticate, isAdmin, updateAPI);
router.delete('/:id',              authenticate, isAdmin, deleteAPI);
router.post('/import/postman',      authenticate, isAdmin, importFromPostman);

export default router;