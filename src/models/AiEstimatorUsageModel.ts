import mongoose from 'mongoose';

const aiEstimatorUsageSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    usedDate: { type: String, required: true, index: true },
    usedAt: { type: Date, default: Date.now },
    promptLength: { type: Number, default: 0 },
}, { timestamps: true });

aiEstimatorUsageSchema.index({ userId: 1, usedDate: 1 }, { unique: true });

const AiEstimatorUsageModel = mongoose.model('AiEstimatorUsage', aiEstimatorUsageSchema);
export default AiEstimatorUsageModel;
