import mongoose from 'mongoose';

const temporaryCloudinaryUploadSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    publicId: { type: String, required: true },
    resourceType: {
        type: String,
        enum: ['image', 'video'],
        required: true,
    },
    url: { type: String, required: false, default: '' },
    source: { type: String, required: false, default: 'listing-form' },
    listingId: { type: String, required: false, default: '' },
    status: {
        type: String,
        enum: ['pending', 'committed', 'deleted', 'cleanupFailed'],
        default: 'pending',
        index: true,
    },
    cleanupAttempts: { type: Number, default: 0 },
    lastCleanupError: { type: String, required: false, default: '' },
    committedAt: { type: Date, required: false, default: null },
    deletedAt: { type: Date, required: false, default: null },
}, { timestamps: true });

temporaryCloudinaryUploadSchema.index({ publicId: 1, resourceType: 1 }, { unique: true });
temporaryCloudinaryUploadSchema.index({ status: 1, createdAt: 1 });

const TemporaryCloudinaryUploadModel = mongoose.model('TemporaryCloudinaryUpload', temporaryCloudinaryUploadSchema);
export default TemporaryCloudinaryUploadModel;
