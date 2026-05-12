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
    handleUpdateListingById
} from '../controllers/ListingController';
import {isAdmin} from "../middlewares/AuthMiddleware";

const router = express.Router();

router.delete('/listings/last', handleDeleteLastListing);
router.delete('/listings/:userId', handleDeleteListingByUserId);
router.delete('/listings/owner/:userName', handleDeleteListingByUserName);
router.delete('/listings/ownerId/:userId', handleDeleteListingByUserId);
router.delete('/api/listing/:id', handleDeleteListingById);
router.get('/api/listings/:id', handleGetListingsById);
router.get('/listing/:id', handleGetListingById);
router.get('/api/listings/ownerId/:userId', handleGetListingsByOwnerId);
router.get('/api/listings/owner/:userName', handleGetListingsByUserName);
router.get('/listings', handleGetListings);
router.post('/listings', handlePostListings);
router.put('/api/listings/:id', handleUpdateListingById);

export default router;
