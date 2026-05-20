import crypto from 'crypto';
import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';

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
