import { Response } from 'express';
import mongoose from 'mongoose';
import FavoriteModel from '../models/FavoriteModel';
import ListingModel from '../models/ListingModel';

const getSessionUserId = (req: any) => req.session?.user?.id;

const isValidListingId = (listingId: string) => mongoose.Types.ObjectId.isValid(listingId);

export const handleGetFavoriteListings = async (req: any, res: Response) => {
    try {
        const userId = getSessionUserId(req);
        const favorites = await FavoriteModel.find({ userId }).sort({ createdAt: -1 }).populate('listingId');
        const listings = favorites.map((favorite) => favorite.get('listingId')).filter(Boolean);

        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetFavoriteListingIds = async (req: any, res: Response) => {
    try {
        const userId = getSessionUserId(req);
        const favorites = await FavoriteModel.find({ userId }).select('listingId');
        const ids = favorites.map((favorite) => String(favorite.get('listingId')));

        res.json({ ids });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleAddFavoriteListing = async (req: any, res: Response) => {
    try {
        const userId = getSessionUserId(req);
        const { listingId } = req.params;

        if (!isValidListingId(listingId)) {
            return res.status(400).json({ message: `Invalid listing ID format: ${listingId}` });
        }

        const listingExists = await ListingModel.exists({ _id: listingId });
        if (!listingExists) {
            return res.status(404).json({ message: 'Listing not found.' });
        }

        await FavoriteModel.updateOne(
            { userId, listingId },
            { $setOnInsert: { userId, listingId } },
            { upsert: true },
        );

        res.status(201).json({ message: 'Listing added to favorites.', listingId });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleRemoveFavoriteListing = async (req: any, res: Response) => {
    try {
        const userId = getSessionUserId(req);
        const { listingId } = req.params;

        if (!isValidListingId(listingId)) {
            return res.status(400).json({ message: `Invalid listing ID format: ${listingId}` });
        }

        const result = await FavoriteModel.deleteOne({ userId, listingId });

        res.json({
            message: result.deletedCount ? 'Listing removed from favorites.' : 'Favorite was not found.',
            listingId,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleSyncFavoriteListings = async (req: any, res: Response) => {
    try {
        const userId = getSessionUserId(req);
        const listingIds = Array.isArray(req.body?.listingIds)
            ? req.body.listingIds.filter((item: unknown): item is string => typeof item === 'string' && isValidListingId(item))
            : [];
        const uniqueIds = Array.from(new Set(listingIds));

        if (uniqueIds.length === 0) {
            const favorites = await FavoriteModel.find({ userId }).select('listingId');
            return res.json({ ids: favorites.map((favorite) => String(favorite.get('listingId'))) });
        }

        const existingListings = await ListingModel.find({ _id: { $in: uniqueIds } }).select('_id');
        const existingIds = existingListings.map((listing) => String(listing._id));

        if (existingIds.length > 0) {
            await FavoriteModel.bulkWrite(
                existingIds.map((listingId) => ({
                    updateOne: {
                        filter: { userId, listingId },
                        update: { $setOnInsert: { userId, listingId } },
                        upsert: true,
                    },
                })),
            );
        }

        const favorites = await FavoriteModel.find({ userId }).select('listingId');
        res.json({ ids: favorites.map((favorite) => String(favorite.get('listingId'))) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
