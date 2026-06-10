import express from 'express';
import {
    handleCreatePromotionRequest,
    handleGetAdminPromotionRequestCount,
    handleGetAdminPromotionRequests,
    handleUpdateAdminPromotionRequest,
} from '../controllers/PromotionRequestController';
import { requireAdmin, requireStandardOrPremiumOrAdmin } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.post('/api/promotion-requests', requireStandardOrPremiumOrAdmin, handleCreatePromotionRequest);
router.get('/api/admin/promotion-requests', requireAdmin, handleGetAdminPromotionRequests);
router.get('/api/admin/promotion-requests/count', requireAdmin, handleGetAdminPromotionRequestCount);
router.patch('/api/admin/promotion-requests/:requestId', requireAdmin, handleUpdateAdminPromotionRequest);

export default router;
