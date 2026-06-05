import express from 'express';
import {
    handleCreateVerificationRequest,
    handleGetAdminVerificationRequests,
    handleGetMyVerificationRequests,
    handleReviewVerificationRequest,
} from '../controllers/VerificationController';
import { requireAdmin, requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.get('/api/verification-requests/my', requireAuth, handleGetMyVerificationRequests);
router.get('/api/admin/verification-requests', requireAdmin, handleGetAdminVerificationRequests);
router.patch('/api/admin/verification-requests/:requestId', requireAdmin, handleReviewVerificationRequest);
router.post('/api/listings/:listingId/verification-requests', requireAuth, handleCreateVerificationRequest);

export default router;
