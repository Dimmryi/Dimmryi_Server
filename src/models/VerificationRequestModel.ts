import mongoose from 'mongoose';

const verificationFileSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        publicId: { type: String, required: false },
        resourceType: { type: String, required: false },
        format: { type: String, required: false },
        bytes: { type: Number, required: false, default: 0 },
        originalName: { type: String, required: false },
    },
    { _id: false }
);

const verificationRequestSchema = new mongoose.Schema(
    {
        listingId: { type: String, required: true, index: true },
        userId: { type: String, required: true, index: true },
        requestType: {
            type: String,
            enum: ['owner', 'representative'],
            required: true,
        },
        documentType: {
            type: String,
            enum: ['technicalPassport', 'ownershipExtract', 'representativeDocument'],
            required: true,
        },
        files: { type: [verificationFileSchema], required: true },
        comment: { type: String, required: false, default: '' },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
            index: true,
        },
        rejectionReason: { type: String, required: false, default: '' },
        reviewedBy: { type: String, required: false, default: '' },
        reviewedAt: { type: Date, required: false, default: null },
    },
    { timestamps: true }
);

const VerificationRequestModel = mongoose.model('VerificationRequest', verificationRequestSchema);
export default VerificationRequestModel;
