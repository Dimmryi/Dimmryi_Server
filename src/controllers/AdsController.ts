import mongoose from 'mongoose';
import { Request, Response } from 'express';
import AdsModel from '../models/AdsModel';

export const handleGetAds = async (req: Request, res: Response) => {
    try {
        const ads = await AdsModel.find();
        res.json(ads);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetFeaturedAd = async (req: Request, res: Response) => {
    try {
        const ad = await AdsModel.findOne({ isFeatured: true });
        res.json(ad);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostAd = async (req: Request, res: Response) => {
    try {
        const { publicId, adsString, ownerName, videoUrl } = req.body;
        const newAds = new AdsModel({
            publicId,
            adsString,
            ownerName,
            videoUrl,
            dateUpload: `${Date.now()}`,
            isFeatured: false,
        });
        await newAds.save();
        res.status(201).json({ message: 'Advertisement saved successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleSetFeaturedAd = async (req: any, res: any) => {
    const { adId } = req.body;
    try {
        await AdsModel.updateMany({ isFeatured: true }, { isFeatured: false });

        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ message: `Invalid ID format: ${adId}` });
        }

        await AdsModel.findByIdAndUpdate(new mongoose.Types.ObjectId(adId), { isFeatured: true });
        res.status(200).json({ message: 'Featured ad updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateAdString = async (req: any, res: any) => {
    const { adId, modifiedString } = req.body;
    try {
        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ message: `Invalid ID format: ${adId}` });
        }

        await AdsModel.findByIdAndUpdate(
            new mongoose.Types.ObjectId(adId),
            { adsString: modifiedString }
        );
        res.status(200).json({ message: 'Ad text updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteAd = async (req: any, res: any) => {
    try {
        const { publicId } = req.params;
        const deleted = await AdsModel.deleteMany({ publicId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'No ads found.' });
        }

        res.status(200).json({ message: 'Advertisement deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
