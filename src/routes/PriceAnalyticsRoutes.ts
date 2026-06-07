import express from 'express';
import {
    handleDeletePriceAnalyticsSnapshot,
    handleGetAdminPriceAnalytics,
    handleGetPriceAnalytics,
    handleUpsertPriceAnalyticsSnapshot,
} from '../controllers/PriceAnalyticsController';
import { requireAdmin } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.get('/api/price-analytics', handleGetPriceAnalytics);
router.get('/api/admin/price-analytics', requireAdmin, handleGetAdminPriceAnalytics);
router.post('/api/admin/price-analytics', requireAdmin, handleUpsertPriceAnalyticsSnapshot);
router.delete('/api/admin/price-analytics/:snapshotId', requireAdmin, handleDeletePriceAnalyticsSnapshot);

export default router;
