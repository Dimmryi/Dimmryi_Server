import express from 'express';
import {
    handleInitChat,
    handleGetChat,
    handleGetChatsByListing,
    handleMarkRead,
} from '../controllers/ChatController';
import { requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.post('/api/chat/init', requireAuth, handleInitChat);
router.get('/api/chat/listing/:listingId', requireAuth, handleGetChatsByListing);
router.get('/api/chat/:chatId', requireAuth, handleGetChat);
router.patch('/api/chat/:chatId/read', requireAuth, handleMarkRead);

export default router;
