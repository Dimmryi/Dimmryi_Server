import mongoose from 'mongoose';

const priceAnalyticsSnapshotSchema = new mongoose.Schema(
    {
        region: { type: String, required: true, trim: true, index: true },
        city: { type: String, required: false, trim: true, default: '', index: true },
        listingType: {
            type: String,
            enum: ['sale', 'rent'],
            required: true,
            index: true,
        },
        propertyType: {
            type: String,
            enum: ['flat', 'private house', 'commercial real estate'],
            required: true,
            index: true,
        },
        marketType: {
            type: String,
            enum: ['primary', 'secondary', 'all'],
            default: 'all',
            index: true,
        },
        periodMonth: {
            type: String,
            required: true,
            match: /^\d{4}-\d{2}$/,
            index: true,
        },
        averagePrice: { type: Number, required: false, default: 0 },
        medianPrice: { type: Number, required: false, default: 0 },
        pricePerSquareMeter: { type: Number, required: true },
        sampleSize: { type: Number, required: false, default: 0 },
        currency: { type: String, enum: ['USD', 'UAH', 'EUR'], default: 'USD' },
        source: { type: String, required: true, trim: true },
        sourceUrl: { type: String, required: false, trim: true, default: '' },
        confidence: {
            type: String,
            enum: ['high', 'medium', 'low'],
            default: 'medium',
        },
        note: { type: String, required: false, trim: true, default: '' },
    },
    { timestamps: true }
);

priceAnalyticsSnapshotSchema.index(
    {
        region: 1,
        city: 1,
        listingType: 1,
        propertyType: 1,
        marketType: 1,
        periodMonth: 1,
        source: 1,
    },
    { unique: true }
);

export default mongoose.model('PriceAnalyticsSnapshot', priceAnalyticsSnapshotSchema);
