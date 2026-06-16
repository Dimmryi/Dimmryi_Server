import crypto from 'crypto';
import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import Listing from '../models/ListingModel';
import AgentModel from '../models/AgentModel';
import TemporaryCloudinaryUploadModel from '../models/TemporaryCloudinaryUploadModel';

const VERIFICATION_UPLOAD_PRESET = process.env.CLOUDINARY_VERIFICATION_PRESET || 'verification_documents_signed';
const VERIFICATION_UPLOAD_FOLDER = process.env.CLOUDINARY_VERIFICATION_FOLDER || 'verification-documents';
const SIGNATURE_TTL_SECONDS = 10 * 60;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getPublicIdPattern = (publicId: string) => new RegExp(`(?:^|/)${escapeRegExp(publicId)}(?:\\.[^/?#]+)?(?:[?#]|$)`);

const isFreshTimestamp = (timestamp: unknown) => {
    const value = Number(timestamp);
    if (!Number.isFinite(value)) return false;

    const now = Math.floor(Date.now() / 1000);
    return Math.abs(now - value) <= SIGNATURE_TTL_SECONDS;
};

const isValidPublicId = (publicId: unknown): publicId is string =>
    typeof publicId === 'string' &&
    publicId.trim().length > 0 &&
    publicId.length <= 255 &&
    !publicId.includes('..') &&
    !/^https?:\/\//i.test(publicId);

const validateSignatureParams = (req: Request, res: Response) => {
    const { public_id, timestamp } = req.body;

    if (!isValidPublicId(public_id)) {
        res.status(400).json({ message: 'Invalid Cloudinary public_id.' });
        return null;
    }

    if (!isFreshTimestamp(timestamp)) {
        res.status(400).json({ message: 'Cloudinary signature timestamp is invalid or expired.' });
        return null;
    }

    return { publicId: public_id.trim(), timestamp };
};

const normalizeResourceType = (value: unknown) => (value === 'video' ? 'video' : 'image');

const canSignDeleteForAsset = async (req: any, publicId: string) => {
    const user = req.session?.user;
    if (!user?.id) return false;
    if (user.role === 'admin') return true;

    const pattern = getPublicIdPattern(publicId);
    const [listing, agent] = await Promise.all([
        Listing.exists({
            ownerId: user.id,
            $or: [
                { image: { $regex: pattern } },
                { video: { $regex: pattern } },
            ],
        }),
        AgentModel.exists({
            userId: user.id,
            image: { $regex: pattern },
        }),
    ]);

    return Boolean(listing || agent);
};

export const handleGenerateSignature = async (req: Request, res: Response) => {
    const params = validateSignatureParams(req, res);
    if (!params) return;

    if (req.body?.intent === 'delete' && !(await canSignDeleteForAsset(req, params.publicId))) {
        return res.status(403).json({ message: 'Cloudinary asset does not belong to the current user.' });
    }

    const stringToSign = `public_id=${params.publicId}&timestamp=${params.timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');
    res.json({ signature, timestamp: params.timestamp, api_key: process.env.CLOUDINARY_API_KEY });
};

export const handleGenerateSignatureVideo = (req: Request, res: Response) => {
    const params = validateSignatureParams(req, res);
    if (!params) return;

    const signature = cloudinary.utils.api_sign_request(
        { public_id: params.publicId, timestamp: params.timestamp, resource_type: 'video' },
        process.env.CLOUDINARY_API_SECRET || ''
    );
    res.json({ signature, timestamp: params.timestamp, api_key: process.env.CLOUDINARY_API_KEY });
};

export const handleGenerateSignatureDeleteVideo = async (req: Request, res: Response) => {
    const params = validateSignatureParams(req, res);
    if (!params) return;

    if (req.body?.intent === 'delete' && !(await canSignDeleteForAsset(req, params.publicId))) {
        return res.status(403).json({ message: 'Cloudinary asset does not belong to the current user.' });
    }

    const signature = cloudinary.utils.api_sign_request(
        { public_id: params.publicId, timestamp: params.timestamp },
        process.env.CLOUDINARY_API_SECRET || ''
    );
    res.json({ signature, timestamp: params.timestamp, api_key: cloudinary.config().api_key });
};

export const handleGenerateVerificationUploadSignature = (_req: Request, res: Response) => {
    const apiSecret = process.env.CLOUDINARY_API_SECRET || '';
    const apiKey = process.env.CLOUDINARY_API_KEY || cloudinary.config().api_key;

    if (!apiSecret || !apiKey) {
        return res.status(503).json({ message: 'Cloudinary credentials are not configured.' });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
        {
            folder: VERIFICATION_UPLOAD_FOLDER,
            timestamp,
            upload_preset: VERIFICATION_UPLOAD_PRESET,
        },
        apiSecret
    );

    res.json({
        signature,
        timestamp,
        api_key: apiKey,
        folder: VERIFICATION_UPLOAD_FOLDER,
        upload_preset: VERIFICATION_UPLOAD_PRESET,
    });
};

export const handleRegisterTemporaryUpload = async (req: any, res: Response) => {
    try {
        const userId = req.session?.user?.id;
        const { publicId, url, resourceType, source } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!isValidPublicId(publicId)) {
            return res.status(400).json({ message: 'Invalid Cloudinary publicId.' });
        }

        const normalizedResourceType = normalizeResourceType(resourceType);

        const upload = await TemporaryCloudinaryUploadModel.findOneAndUpdate(
            { publicId: publicId.trim(), resourceType: normalizedResourceType },
            {
                $set: {
                    userId,
                    url: typeof url === 'string' ? url : '',
                    source: typeof source === 'string' ? source : 'listing-form',
                    status: 'pending',
                    lastCleanupError: '',
                    deletedAt: null,
                    committedAt: null,
                },
                $setOnInsert: {
                    cleanupAttempts: 0,
                },
            },
            { new: true, upsert: true, runValidators: true },
        );

        res.status(201).json({ ok: true, id: upload._id });
    } catch (error) {
        console.error('Temporary Cloudinary upload registration failed:', error);
        res.status(500).json({ message: 'Could not register temporary upload.' });
    }
};

export const handleMarkTemporaryUploadDeleted = async (req: any, res: Response) => {
    try {
        const userId = req.session?.user?.id;
        const { publicId, resourceType } = req.body || {};

        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!isValidPublicId(publicId)) {
            return res.status(400).json({ message: 'Invalid Cloudinary publicId.' });
        }

        const normalizedResourceType = normalizeResourceType(resourceType);

        await TemporaryCloudinaryUploadModel.updateMany(
            { userId, publicId: publicId.trim(), resourceType: normalizedResourceType },
            {
                $set: {
                    status: 'deleted',
                    deletedAt: new Date(),
                    lastCleanupError: '',
                },
            },
        );

        res.json({ ok: true });
    } catch (error) {
        console.error('Temporary Cloudinary upload delete mark failed:', error);
        res.status(500).json({ message: 'Could not update temporary upload state.' });
    }
};
