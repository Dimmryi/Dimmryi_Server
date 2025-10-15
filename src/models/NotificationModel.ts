import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    listingType: { type: String, required: true },
    propertyType: { type: String, required: true },
    typeOfNovelty: { type: String, required: true },
    minNumbersOfRoom: { type: Number, required: true },
    maxNumbersOfRoom: { type: Number, required: true },
    minTotalArea: { type: Number, required: true },
    maxTotalArea: { type: Number, required: true },
    minFloor: { type: Number, required: true },
    maxFloor: { type: Number, required: true },
    minPrice: { type: Number, required: true },
    maxPrice: { type: Number, required: true },
    locationSought: { type: String, required: false },
    locationRange: { type: Number, required: true },
    lat: { type: Number, required: false },
    lon: { type: Number, required: false },
    email: { type: String, required: true },
    userId: { type: String, required: false },
    date: { type: Number, required: false },
});

const NotificationModel = mongoose.model('Notification', notificationSchema);
export default NotificationModel;