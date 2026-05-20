import express from 'express';
import {
    handleInitChat,
    handleGetChat,
    handleGetChatsByListing,
    handleMarkRead,
} from '../controllers/ChatController';

const router = express.Router();

router.post('/api/chat/init', handleInitChat);
router.get('/api/chat/listing/:listingId', handleGetChatsByListing);
router.get('/api/chat/:chatId', handleGetChat);
router.patch('/api/chat/:chatId/read', handleMarkRead);

export default router;
