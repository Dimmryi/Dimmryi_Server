import crypto from 'crypto';
import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';

const VERIFICATION_UPLOAD_PRESET = process.env.CLOUDINARY_VERIFICATION_PRESET || 'verification_documents_signed';
const VERIFICATION_UPLOAD_FOLDER = process.env.CLOUDINARY_VERIFICATION_FOLDER || 'verification-documents';

export const handleGenerateSignature = (req: Request, res: Response) => {
    const { public_id, timestamp } = req.body;
    const stringToSign = `public_id=${public_id}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');
    res.json({ signature, timestamp, api_key: process.env.CLOUDINARY_API_KEY });
};

export const handleGenerateSignatureVideo = (req: Request, res: Response) => {
    const { public_id, timestamp } = req.body;
    const signature = cloudinary.utils.api_sign_request(
        { public_id, timestamp, resource_type: 'video' },
        process.env.CLOUDINARY_API_SECRET || ''
    );
    res.json({ signature, timestamp, api_key: process.env.CLOUDINARY_API_KEY });
};

export const handleGenerateSignatureDeleteVideo = (req: Request, res: Response) => {
    const { public_id, timestamp } = req.body;
    const signature = cloudinary.utils.api_sign_request(
        { public_id, timestamp },
        process.env.CLOUDINARY_API_SECRET || ''
    );
    res.json({ signature, timestamp, api_key: cloudinary.config().api_key });
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
