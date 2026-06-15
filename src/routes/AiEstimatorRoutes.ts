import express from 'express';
import {
    handleEstimatePropertyValue,
    handleGetAiEstimatorStatus,
} from '../controllers/AiEstimatorController';
import { requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.get('/api/ai-estimator/status', requireAuth, handleGetAiEstimatorStatus);
router.post('/api/ai-estimator/estimate', requireAuth, handleEstimatePropertyValue);

export default router;
