import express from 'express';
import { handleGetUsdUahRate } from '../controllers/ExchangeRateController';

const router = express.Router();

router.get('/api/exchange-rates/usd-uah', handleGetUsdUahRate);

export default router;
