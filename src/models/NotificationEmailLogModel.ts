import mongoose from 'mongoose';

const notificationEmailLogSchema = new mongoose.Schema({
    email: { type: String, required: true, index: true },
    notificationId: { type: String, required: false },
    listingId: { type: String, required: false },
    sentAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

notificationEmailLogSchema.index({ email: 1, sentAt: -1 });

const NotificationEmailLogModel = mongoose.model('NotificationEmailLog', notificationEmailLogSchema);
export default NotificationEmailLogModel;
