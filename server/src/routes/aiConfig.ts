import { Router }                                                from 'express';
import {
  saveAIConfig,
  getAIConfigs,
  getModels,
  deleteAIConfig
}                                                                from '../controllers/aiConfigController';
import authenticate                                              from '../middleware/authenticate';

const router = Router();

router.get('/',                 authenticate, getAIConfigs);
router.post('/',                authenticate, saveAIConfig);
router.get('/:provider/models', authenticate, getModels);
router.delete('/:provider',     authenticate, deleteAIConfig);

export default router;