import express from 'express';
import {
    handleGetAds,
    handleGetFeaturedAd,
    handlePostAd,
    handleSetFeaturedAd,
    handleUpdateAdString,
    handleDeleteAd,
} from '../controllers/AdsController';

const router = express.Router();

router.get('/api/videos', handleGetAds);
router.get('/api/video', handleGetFeaturedAd);
router.post('/api/videos', handlePostAd);
router.post('/api/videos/set-featured', handleSetFeaturedAd);
router.post('/api/videos/modified-string', handleUpdateAdString);
router.delete('/api/videos/:publicId', handleDeleteAd);

export default router;
