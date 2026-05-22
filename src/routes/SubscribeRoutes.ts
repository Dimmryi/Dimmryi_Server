import express from 'express';
import { requireAuth } from '../middlewares/AuthMiddleware';
import {
    handleGetLiqpayParams,
    handleSubscribePay,
    handleLiqpayCallback,
} from '../controllers/SubscribeController';

const router = express.Router();

router.get('/api/liqpay-params', requireAuth, handleGetLiqpayParams);
router.post('/api/subscribe/pay', requireAuth, handleSubscribePay);
router.post('/api/liqpay-callback', handleLiqpayCallback);

export default router;
