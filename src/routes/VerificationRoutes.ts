import express from 'express';
import {
    handleCreateVerificationRequest,
    handleGetMyVerificationRequests,
} from '../controllers/VerificationController';
import { requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.get('/api/verification-requests/my', requireAuth, handleGetMyVerificationRequests);
router.post('/api/listings/:listingId/verification-requests', requireAuth, handleCreateVerificationRequest);

export default router;
