import express from 'express';
import {
    handleGetNotifications,
    handleGetNotificationById,
    handleGetNotificationsByUserId,
    handlePostNotification,
    handleUpdateNotification,
    handleDeleteNotification,
} from '../controllers/NotificationController';
import { requireAdmin, requireAuth, requireStandardOrPremiumOrAdmin } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.get('/api/notifications', requireAdmin, handleGetNotifications);
router.get('/api/notification/:notificationId', requireAuth, handleGetNotificationById);
router.get('/api/notifications/authorId/:userId', requireAuth, handleGetNotificationsByUserId);
router.post('/api/notification', requireStandardOrPremiumOrAdmin, handlePostNotification);
router.put('/api/notification/:notificationId', requireStandardOrPremiumOrAdmin, handleUpdateNotification);
router.delete('/api/notifications/:notificationId', requireAuth, handleDeleteNotification);

export default router;
