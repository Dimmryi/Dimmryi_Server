import express from 'express';
import {
    handleGetNotifications,
    handleGetNotificationById,
    handleGetNotificationsByUserId,
    handlePostNotification,
    handleUpdateNotification,
    handleDeleteNotification,
} from '../controllers/NotificationController';

const router = express.Router();

router.get('/api/notifications', handleGetNotifications);
router.get('/api/notification/:notificationId', handleGetNotificationById);
router.get('/api/notifications/authorId/:userId', handleGetNotificationsByUserId);
router.post('/api/notification', handlePostNotification);
router.put('/api/notification/:notificationId', handleUpdateNotification);
router.delete('/api/notifications/:notificationId', handleDeleteNotification);

export default router;
