import mongoose from 'mongoose';

const adsSchema = new mongoose.Schema({
    videoUrl: { type: [String], required: true },
    ownerName: { type: String, required: true },
    adsString: { type: String, required: true },
    dateUpload: { type: String, required: true },
    publicId: { type: String, required: true },
    isFeatured: {type: Boolean, required: true },
});

const AdsModel = mongoose.model('Ads', adsSchema);
export default AdsModel;