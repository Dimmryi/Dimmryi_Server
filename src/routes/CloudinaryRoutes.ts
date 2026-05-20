import express from 'express';
import {
    handleGenerateSignature,
    handleGenerateSignatureVideo,
    handleGenerateSignatureDeleteVideo,
} from '../controllers/CloudinaryController';

const router = express.Router();

router.post('/generate-signature', handleGenerateSignature);
router.post('/generate-signature-video', handleGenerateSignatureVideo);
router.post('/generate-signature-to-delete-video', handleGenerateSignatureDeleteVideo);

export default router;
