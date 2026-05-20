import express from 'express';
import {
    handleDeleteLastListing,
    handleDeleteListingByUserId,
    handleDeleteListingByUserName,
    handleDeleteListingById,
    handleGetListingsById,
    handleGetListingById,
    handleGetListingsByOwnerId,
    handleGetListingsByUserName,
    handleGetListings,
    handlePostListings,
    handlePostListingsWithComparison,
    handleUpdateListingById,
} from '../controllers/ListingController';

const router = express.Router();

router.get('/listings', handleGetListings);
router.get('/listing/:id', handleGetListingById);
router.get('/api/listings/:id', handleGetListingsById);
router.get('/api/listings/ownerId/:userId', handleGetListingsByOwnerId);
router.get('/api/listings/owner/:userName', handleGetListingsByUserName);
router.post('/listings', handlePostListings);
router.post('/api/listingsWithComparison', handlePostListingsWithComparison);
router.put('/api/listing/:id', handleUpdateListingById);
router.delete('/api/listing/:id', handleDeleteListingById);
router.delete('/listings/last', handleDeleteLastListing);
router.delete('/listings/:userId', handleDeleteListingByUserId);
router.delete('/listings/ownerId/:userId', handleDeleteListingByUserId);
router.delete('/listings/owner/:userName', handleDeleteListingByUserName);

export default router;
