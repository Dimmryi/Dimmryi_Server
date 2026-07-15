import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/UserModel';
import ListingModel from '../models/ListingModel';
import CommentModel from '../models/CommentModel';
import NotificationModel from '../models/NotificationModel';
import FavoriteModel from '../models/FavoriteModel';
import AgentModel from '../models/AgentModel';
import PromotionRequestModel from '../models/PromotionRequestModel';
import ChatModel from '../models/ChatModel';
import AiEstimatorUsageModel from '../models/AiEstimatorUsageModel';
import NotificationEmailLogModel from '../models/NotificationEmailLogModel';
import {
    deleteVerificationDocumentsForListings,
    deleteVerificationDocumentsForUser,
} from '../utils/verificationDocumentsCleanup';
import {
    collectCloudinaryAssetsFromUrls,
    collectListingCloudinaryAssets,
    deleteTemporaryCloudinaryUploadsForUser,
    destroyCloudinaryAssets,
    markTemporaryUploadsCommittedForListing,
} from '../utils/temporaryCloudinaryUploads';

const normalizeCurrency = (value: unknown) => (value === 'USD' ? 'USD' : 'UAH');

export const handleDeleteUserByUserName = async (req: any, res: any) => {
    try {
        const { userName } = req.params;
        const deleted = await User.deleteMany({ name: userName });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        console.error('Error deleting user by username:', error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};

export const handleDeleteUserByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: `Invalid ID format: ${userId}` });
        }

        await deleteVerificationDocumentsForUser(userId);
        const deleted = await User.deleteMany({ _id: new mongoose.Types.ObjectId(userId) });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        console.error('Error deleting user by ID:', error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};

export const handleDeleteUserAndAllByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: `Invalid ID format: ${userId}` });
        }
        const objectId = new mongoose.Types.ObjectId(userId);
        const ownerIdValues: Array<string | mongoose.Types.ObjectId> = [userId, objectId];
        const user = await User.findById(objectId).lean();
        const listings = await ListingModel.find({ ownerId: { $in: ownerIdValues } }).lean();
        const listingIds = listings.map((listing: any) => String(listing._id));
        const listingObjectIds = listings.map((listing: any) => listing._id).filter(Boolean);
        const listingMediaAssets = listings.flatMap((listing: any) => collectListingCloudinaryAssets(listing));
        const agentProfiles = await AgentModel.find({ userId }).lean();
        const agentMediaAssets = agentProfiles.flatMap((agent: any) => collectCloudinaryAssetsFromUrls(agent.image, 'image'));
        const notificationIds = (await NotificationModel.find({ userId }).select('_id email').lean()).map((notification: any) => ({
            id: String(notification._id),
            email: String(notification.email || ''),
        }));
        const emailsForCleanup = Array.from(
            new Set([String(user?.email || ''), ...notificationIds.map((notification) => notification.email)].filter(Boolean)),
        );

        await destroyCloudinaryAssets([...listingMediaAssets, ...agentMediaAssets]);

        await deleteVerificationDocumentsForListings(listingIds);
        await deleteVerificationDocumentsForUser(userId);
        await deleteTemporaryCloudinaryUploadsForUser(userId);
        await FavoriteModel.deleteMany({
            $or: [
                { userId },
                { listingId: { $in: listingObjectIds } },
            ],
        });
        await ChatModel.deleteMany({
            $or: [
                { buyerId: userId },
                { sellerId: userId },
                { listingId: { $in: listingIds } },
            ],
        });
        await PromotionRequestModel.deleteMany({
            $or: [
                { userId },
                { listingId: { $in: listingIds } },
            ],
        });
        await AiEstimatorUsageModel.deleteMany({ userId });
        await NotificationEmailLogModel.deleteMany({
            $or: [
                { email: { $in: emailsForCleanup } },
                { notificationId: { $in: notificationIds.map((notification) => notification.id) } },
                { listingId: { $in: listingIds } },
            ],
        });
        await AgentModel.deleteMany({ userId });
        await ListingModel.deleteMany({ ownerId: { $in: ownerIdValues } });
        await CommentModel.deleteMany({
            $or: [
                { authorId: { $in: [userId, objectId] } },
                { listingId: { $in: listingIds } },
            ],
        });
        await NotificationModel.deleteMany({ userId });
        const deleted = await User.deleteMany({ _id: objectId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User and all associated data deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Deletion failed.' });
    }
};

export const handlePostUsersToBase = async (req: any, res: any) => {
    try {
        const { name, email, password } = req.body;
        const existingUser: any = await User.findOne({ email });

        if (existingUser) {
            if (existingUser.authMethod === 'google') {
                return res.status(409).json({ message: 'User registered with Google', authMethod: 'google' });
            }

            const passwordMatch = await bcrypt.compare(password, existingUser.password);
            return res.status(409).json({ message: 'User already exists', authMethod: 'password', passwordMatch });
        }

        const newUser = new User({ name, email, password, authMethod: 'password' });
        await newUser.save();

        req.session.user = {
            id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role || 'user',
            authMethod: 'password',
        };
        await req.session.save();

        res.status(201).json({
            message: 'User registered successfully!',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                authMethod: 'password',
                subscribeType: newUser.subscribeType,
                subscribeExpired: newUser.subscribeExpired,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering user.' });
    }
};

// Handles listing update via the /api/listings/:id route mounted in UserRoutes
export const handlePostedAndEditUser = async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const existingListing = await ListingModel.findById(id);

        if (!existingListing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        const currentUserId = req.session.user?.id;
        const currentUserName = req.session.user?.name;
        const currentUserRole = req.session.user?.role;

        if (existingListing.owner !== currentUserName && currentUserRole !== 'admin' && existingListing.ownerId !== currentUserId) {
            return res.status(403).json({ message: `Unauthorized. You must be the owner or an admin.` });
        }

        const allowedUpdates = {
            apartmentDetails: updatedData.apartmentDetails,
            description: updatedData.description,
            contact: updatedData.contact,
            price: updatedData.price,
            currency: normalizeCurrency(updatedData.currency),
            location: updatedData.location,
            image: updatedData.image,
            propertyType: updatedData.propertyType,
            date: Date.now(),
        };

        const updatedListing = await ListingModel.findByIdAndUpdate(
            id,
            { $set: allowedUpdates },
            { new: true, runValidators: true }
        );

        await markTemporaryUploadsCommittedForListing(updatedListing, currentUserId || existingListing.ownerId).catch((error) => {
            console.error('Temporary upload commit failed:', error);
        });

        res.json(updatedListing);
    } catch (error) {
        console.error('Error updating listing:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};
