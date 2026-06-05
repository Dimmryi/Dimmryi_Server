import { Response } from 'express';
import mongoose from 'mongoose';
import Listing from '../models/ListingModel';
import User from '../models/UserModel';
import VerificationRequestModel from '../models/VerificationRequestModel';

const allowedRequestTypes = ['owner', 'representative'];
const allowedDocumentTypes = ['technicalPassport', 'ownershipExtract', 'representativeDocument'];
const approvedListingStatuses = ['documentsVerified', 'representativeVerified'];
const allowedRequestStatuses = ['pending', 'approved', 'rejected'];
const allowedReviewDecisions = ['documentsVerified', 'representativeVerified', 'rejected'];
const MAX_VERIFICATION_FILES = 6;
const MAX_VERIFICATION_FILE_SIZE = 3 * 1024 * 1024;

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
                publicId: typeof file.publicId === 'string' ? file.publicId.trim() : '',
                resourceType: typeof file.resourceType === 'string' ? file.resourceType.trim() : '',
                format: typeof file.format === 'string' ? file.format.trim().toLowerCase() : '',
                bytes: Number.isFinite(Number(file.bytes)) ? Number(file.bytes) : 0,
                originalName: typeof file.originalName === 'string' ? file.originalName : '',
            };
        })
        .filter(Boolean);
};

const validateFiles = (files: any[]) => {
    if (files.length === 0) return 'At least one verification document is required.';
    if (files.length > MAX_VERIFICATION_FILES) return 'No more than 6 verification documents are allowed.';

    const fileWithoutPublicId = files.find((file) => !file.publicId);
    if (fileWithoutPublicId) return 'Verification document publicId is required.';

    const invalidType = files.find((file) => file.resourceType !== 'image' && file.format !== 'pdf');
    if (invalidType) return 'Only image and PDF verification documents are allowed.';

    const oversized = files.find((file) => file.bytes > MAX_VERIFICATION_FILE_SIZE);
    if (oversized) return 'Each verification document must be 3 MB or smaller.';

    return '';
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

        const filesError = validateFiles(files);
        if (filesError) {
            return res.status(400).json({ message: filesError });
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

export const handleGetAdminVerificationRequests = async (req: any, res: Response) => {
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : '';
        const query = allowedRequestStatuses.includes(status) ? { status } : {};
        const requests = await VerificationRequestModel.find(query).sort({ createdAt: -1 }).lean();

        const listingIds = requests
            .map((request) => request.listingId)
            .filter((id) => mongoose.Types.ObjectId.isValid(id));
        const userIds = requests
            .map((request) => request.userId)
            .filter((id) => mongoose.Types.ObjectId.isValid(id));

        const [listings, users] = await Promise.all([
            Listing.find({ _id: { $in: listingIds } }).lean(),
            User.find({ _id: { $in: userIds } }).select('name email role subscribeType subscribeExpired').lean(),
        ]);

        const listingById = new Map(listings.map((listing: any) => [String(listing._id), listing]));
        const userById = new Map(users.map((user: any) => [String(user._id), user]));

        res.json(
            requests.map((request) => ({
                ...request,
                listing: listingById.get(request.listingId) || null,
                user: userById.get(request.userId) || null,
            }))
        );
    } catch (error) {
        console.error('Get admin verification requests error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleReviewVerificationRequest = async (req: any, res: Response) => {
    try {
        const { requestId } = req.params;
        const { decision, rejectionReason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ message: 'Invalid verification request id.' });
        }

        if (!allowedReviewDecisions.includes(decision)) {
            return res.status(400).json({ message: 'Invalid verification decision.' });
        }

        const verificationRequest = await VerificationRequestModel.findById(requestId);
        if (!verificationRequest) {
            return res.status(404).json({ message: 'Verification request not found.' });
        }

        const listing = await Listing.findById(verificationRequest.listingId);
        if (!listing) {
            return res.status(404).json({ message: 'Listing not found.' });
        }

        verificationRequest.reviewedBy = req.session.user.id;
        verificationRequest.reviewedAt = new Date();

        if (decision === 'rejected') {
            verificationRequest.status = 'rejected';
            verificationRequest.rejectionReason = typeof rejectionReason === 'string' ? rejectionReason.trim() : '';
            listing.verificationStatus = 'rejected';
        } else {
            verificationRequest.status = 'approved';
            verificationRequest.rejectionReason = '';
            listing.verificationStatus = decision;
        }

        await Promise.all([verificationRequest.save(), listing.save()]);

        res.json({
            message: 'Verification request reviewed.',
            request: verificationRequest,
            listing,
        });
    } catch (error) {
        console.error('Review verification request error:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
