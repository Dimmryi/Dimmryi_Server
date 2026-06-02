import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
    {
        userId: { type: String, required: true, index: true },
        listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    },
    { timestamps: true },
);

favoriteSchema.index({ userId: 1, listingId: 1 }, { unique: true });

const FavoriteModel = mongoose.model('Favorite', favoriteSchema);
export default FavoriteModel;
