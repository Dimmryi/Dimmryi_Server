import mongoose from 'mongoose';

const listingSnapshotSchema = new mongoose.Schema(
    {
        listingNumber: { type: Number, required: false },
        listingType: { type: String, required: false, default: '' },
        propertyType: { type: String, required: false, default: '' },
        location: { type: String, required: false, default: '' },
        price: { type: Number, required: false },
        currency: { type: String, required: false, default: 'UAH' },
    },
    { _id: false }
);

const promotionRequestSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true },
        email: { type: String, required: true },
        role: { type: String, required: false, default: 'user' },
        subscribeType: { type: String, required: false, default: 'Free' },
        requestType: {
            type: String,
            enum: ['existing-listing-promotion', 'new-property-shoot'],
            required: true,
            index: true,
        },
        listingId: { type: String, required: false, default: '', index: true },
        listingNumber: { type: Number, required: false },
        listing: { type: listingSnapshotSchema, required: false, default: null },
        status: {
            type: String,
            enum: ['new', 'inProgress', 'completed', 'rejected'],
            default: 'new',
            index: true,
        },
        adminNote: { type: String, required: false, default: '' },
        reviewedBy: { type: String, required: false, default: '' },
        reviewedAt: { type: Date, required: false, default: null },
    },
    { timestamps: true }
);

promotionRequestSchema.index({ listingId: 1, status: 1 });
promotionRequestSchema.index({ createdAt: -1 });

const PromotionRequestModel = mongoose.model('PromotionRequest', promotionRequestSchema);
export default PromotionRequestModel;
