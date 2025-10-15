import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
    listingNumber: { type: Number, required: false, unique: true },
    typeOfNovelty: { type: String, required: false },
    numbersOfRooms: { type: Number, required: false },
    totalArea: { type: Number, required: false },
    numberOfFloor: { type: Number, required: false },
    numberOfStoreysOfBuilding: { type: Number, required: false },
    apartmentDetails: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    image: { type: [String], required: true },
    owner: { type: String, required: true },
    ownerId: { type: String, required: true },
    email: { type: String, required: true },
    contact: { type: String, required: true },
    location: { type: String, required: true },
    date: { type: String, required: true },
    listingType: { type: String, required: true },
    propertyType: { type: String, required: true },
    lat: { type: Number, required: false },
    lon: { type: Number, required: false },
});

const ListingModel = mongoose.model('Listing', listingSchema);
export default ListingModel;
