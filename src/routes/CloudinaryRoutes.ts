import express from 'express';
import {
    handleGenerateSignature,
    handleGenerateSignatureVideo,
    handleGenerateSignatureDeleteVideo,
    handleGenerateVerificationUploadSignature,
} from '../controllers/CloudinaryController';
import { requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.post('/generate-signature', handleGenerateSignature);
router.post('/generate-signature-video', handleGenerateSignatureVideo);
router.post('/generate-signature-to-delete-video', handleGenerateSignatureDeleteVideo);
router.post('/api/cloudinary/verification-signature', requireAuth, handleGenerateVerificationUploadSignature);

export default router;
