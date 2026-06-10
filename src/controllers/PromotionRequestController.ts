import { Response } from 'express';
import mongoose from 'mongoose';
import Listing from '../models/ListingModel';
import PromotionRequestModel from '../models/PromotionRequestModel';
import User from '../models/UserModel';

const allowedRequestTypes = ['existing-listing-promotion', 'new-property-shoot'];
const allowedStatuses = ['new', 'inProgress', 'completed', 'rejected'] as const;
const openStatuses = ['new', 'inProgress'];
type PromotionRequestStatus = typeof allowedStatuses[number];

const sanitizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const isAllowedStatus = (value: string): value is PromotionRequestStatus =>
    allowedStatuses.includes(value as PromotionRequestStatus);

const buildCounts = async () => {
    const rows = await PromotionRequestModel.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return allowedStatuses.reduce<Record<string, number>>((acc, status) => {
        acc[status] = rows.find((row) => row._id === status)?.count || 0;
        return acc;
    }, {});
};

const buildListingSnapshot = (listing: any) => ({
    listingNumber: listing.listingNumber,
    listingType: listing.listingType || '',
    propertyType: listing.propertyType || '',
    location: listing.location || '',
    price: listing.price,
    currency: listing.currency || 'UAH',
});

const getValidationFields = (error: mongoose.Error.ValidationError) => Object.keys(error.errors);

const sendListingValidationError = (res: Response, error: unknown, message: string) => {
    if (error instanceof mongoose.Error.ValidationError) {
        res.status(422).json({ message, fields: getValidationFields(error) });
        return true;
    }

    return false;
};

export const handleCreatePromotionRequest = async (req: any, res: Response) => {
    try {
        const requestType = sanitizeText(req.body.requestType);
        const listingId = sanitizeText(req.body.listingId);

        if (!allowedRequestTypes.includes(requestType)) {
            return res.status(400).json({ message: 'Invalid promotion request type.' });
        }

        let listing: any = null;

        if (requestType === 'existing-listing-promotion') {
            if (!mongoose.Types.ObjectId.isValid(listingId)) {
                return res.status(400).json({ message: 'Invalid listing id.' });
            }

            listing = await Listing.findById(listingId);
            if (!listing) {
                return res.status(404).json({ message: 'Listing not found.' });
            }

            const isOwner = listing.ownerId === req.session.user.id;
            const isAdmin = req.session.user.role === 'admin';
            if (!isOwner && !isAdmin) {
                return res.status(403).json({ message: 'Only listing owner or admin can request promotion.' });
            }

            const existingOpenRequest = await PromotionRequestModel.findOne({
                listingId,
                status: { $in: openStatuses },
            });

            if (existingOpenRequest) {
                return res.status(409).json({ message: 'Promotion request is already open for this listing.' });
            }
        }

        const user = req.subscriptionUser || await User.findById(req.session.user.id);
        const name = sanitizeText(user?.name) || sanitizeText(req.session.user.name) || sanitizeText(req.body.name);
        const email = sanitizeText(user?.email) || sanitizeText(req.session.user.email) || sanitizeText(req.body.email);

        if (!name || !email) {
            return res.status(400).json({ message: 'User name and email are required.' });
        }

        if (listing) {
            listing.promotionStatus = 'pending';
            const validationError = listing.validateSync();
            if (validationError) {
                return sendListingValidationError(res, validationError, 'Listing must be updated to the current listing format before a promotion request can be submitted.');
            }
        }

        const promotionRequest = await PromotionRequestModel.create({
            userId: req.session.user.id,
            name,
            email,
            role: req.session.user.role || user?.role || 'user',
            subscribeType: user?.subscribeType || (req.session.user.role === 'admin' ? 'Admin' : 'Free'),
            requestType,
            listingId: listing ? String(listing._id) : '',
            listingNumber: listing?.listingNumber,
            listing: listing ? buildListingSnapshot(listing) : null,
            status: 'new',
        });

        if (listing) {
            await listing.save();
        }

        res.status(201).json({
            message: 'Promotion request submitted.',
            request: promotionRequest,
        });
    } catch (error) {
        console.error('Create promotion request error:', error);
        if (sendListingValidationError(res, error, 'Listing must be updated to the current listing format before a promotion request can be submitted.')) {
            return;
        }
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAdminPromotionRequests = async (req: any, res: Response) => {
    try {
        const status = sanitizeText(req.query.status);
        const query = isAllowedStatus(status) ? { status } : {};

        const [items, total, counts] = await Promise.all([
            PromotionRequestModel.find(query).sort({ createdAt: -1 }).lean(),
            PromotionRequestModel.countDocuments(),
            buildCounts(),
        ]);

        res.json({ items, total, counts });
    } catch (error) {
        console.error('Get admin promotion requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetAdminPromotionRequestCount = async (_req: any, res: Response) => {
    try {
        const [total, counts] = await Promise.all([
            PromotionRequestModel.countDocuments(),
            buildCounts(),
        ]);

        res.json({ total, counts });
    } catch (error) {
        console.error('Get admin promotion request count error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateAdminPromotionRequest = async (req: any, res: Response) => {
    try {
        const { requestId } = req.params;
        const status = sanitizeText(req.body.status);
        const adminNote = sanitizeText(req.body.adminNote);

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Invalid promotion request id.' });
        }

        if (!isAllowedStatus(status)) {
            return res.status(400).json({ message: 'Invalid promotion request status.' });
        }
        const nextStatus = status;

        const promotionRequest = await PromotionRequestModel.findById(requestId);
        if (!promotionRequest) {
            return res.status(404).json({ message: 'Promotion request not found.' });
        }

        const statusChanged = promotionRequest.status !== nextStatus;
        const listingId = promotionRequest.listingId;
        const listing = statusChanged && listingId && mongoose.Types.ObjectId.isValid(listingId)
            ? await Listing.findById(listingId)
            : null;

        if (listing) {
            if (nextStatus === 'rejected') {
                listing.promotionStatus = 'none';
                listing.promotionPriority = 0;
            } else if (nextStatus === 'completed') {
                listing.promotionStatus = 'active';
                listing.promotionPriority = Math.max(listing.promotionPriority || 0, 1);
                listing.promotionStartedAt = listing.promotionStartedAt || new Date();
            } else {
                listing.promotionStatus = 'pending';
            }

            const validationError = listing.validateSync();
            if (validationError) {
                return sendListingValidationError(res, validationError, 'Listing must be updated to the current listing format before this promotion status can be applied.');
            }
        }

        promotionRequest.status = nextStatus;
        promotionRequest.adminNote = adminNote;
        promotionRequest.reviewedBy = req.session.user.id;
        promotionRequest.reviewedAt = new Date();

        await Promise.all([
            promotionRequest.save(),
            listing ? listing.save() : Promise.resolve(),
        ]);

        res.json({
            message: 'Promotion request updated.',
            request: promotionRequest,
            listing,
        });
    } catch (error) {
        console.error('Update admin promotion request error:', error);
        if (sendListingValidationError(res, error, 'Listing must be updated to the current listing format before this promotion status can be applied.')) {
            return;
        }
        res.status(500).json({ error: 'Server error' });
    }
};
