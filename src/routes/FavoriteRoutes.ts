import express from 'express';
import {
    handleAddFavoriteListing,
    handleGetFavoriteListingIds,
    handleGetFavoriteListings,
    handleRemoveFavoriteListing,
    handleSyncFavoriteListings,
} from '../controllers/FavoriteController';
import { requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.get('/api/favorites', requireAuth, handleGetFavoriteListings);
router.get('/api/favorites/ids', requireAuth, handleGetFavoriteListingIds);
router.post('/api/favorites/sync', requireAuth, handleSyncFavoriteListings);
router.post('/api/favorites/:listingId', requireAuth, handleAddFavoriteListing);
router.delete('/api/favorites/:listingId', requireAuth, handleRemoveFavoriteListing);

export default router;
