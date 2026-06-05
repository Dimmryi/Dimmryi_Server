import { Response } from 'express';
import mongoose from 'mongoose';
import Listing from '../models/ListingModel';
import VerificationRequestModel from '../models/VerificationRequestModel';

const allowedRequestTypes = ['owner', 'representative'];
const allowedDocumentTypes = ['technicalPassport', 'ownershipExtract', 'representativeDocument'];
const approvedListingStatuses = ['documentsVerified', 'representativeVerified'];

const normalizeFiles = (value: unknown) => {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const file = item as Record<string, unknown>;
            const url = typeof file.url === 'string' ? file.url.trim() : '';
            if (!url) return null;

            return {
                url,
                publicId: typeof file.publicId === 'string' ? file.publicId : '',
                resourceType: typeof file.resourceType === 'string' ? file.resourceType : '',
                originalName: typeof file.originalName === 'string' ? file.originalName : '',
            };
        })
        .filter(Boolean);
};

export const handleCreateVerificationRequest = async (req: any, res: Response) => {
    try {
        const { listingId } = req.params;
        const { requestType, documentType, comment } = req.body;
        const files = normalizeFiles(req.body.files);

        if (!mongoose.Types.ObjectId.isValid(listingId)) {
            return res.status(400).json({ message: 'Invalid listing id.' });
        }

        if (!allowedRequestTypes.includes(requestType)) {
            return res.status(400).json({ message: 'Invalid verification request type.' });
        }

        if (!allowedDocumentTypes.includes(documentType)) {
            return res.status(400).json({ message: 'Invalid verification document type.' });
        }

        if (files.length === 0) {
            return res.status(400).json({ message: 'At least one verification document is required.' });
        }

        const listing = await Listing.findById(listingId);
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found.' });
        }

        const isOwner = listing.ownerId === req.session.user.id;
        const isAdmin = req.session.user.role === 'admin';
        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'Only listing owner or admin can request verification.' });
        }

        if (approvedListingStatuses.includes(listing.verificationStatus)) {
            return res.status(409).json({ message: 'Listing is already verified.' });
        }

        const existingPendingRequest = await VerificationRequestModel.findOne({
            listingId,
            status: 'pending',
        });

        if (existingPendingRequest) {
            return res.status(409).json({ message: 'Verification request is already pending for this listing.' });
        }

        const verificationRequest = await VerificationRequestModel.create({
            listingId,
            userId: req.session.user.id,
            requestType,
            documentType,
            files,
            comment: typeof comment === 'string' ? comment.trim() : '',
            status: 'pending',
        });

        listing.verificationStatus = 'pending';
        await listing.save();

        res.status(201).json({
            message: 'Verification request submitted.',
            request: verificationRequest,
            listing,
        });
    } catch (error) {
        console.error('Create verification request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetMyVerificationRequests = async (req: any, res: Response) => {
    try {
        const query = req.session.user.role === 'admin' ? {} : { userId: req.session.user.id };
        const requests = await VerificationRequestModel.find(query).sort({ createdAt: -1 }).lean();
        res.json(requests);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
