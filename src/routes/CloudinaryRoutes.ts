import express from 'express';
import {
    handleGenerateSignature,
    handleGenerateSignatureVideo,
    handleGenerateSignatureDeleteVideo,
    handleGenerateVerificationUploadSignature,
    handleMarkTemporaryUploadDeleted,
    handleRegisterTemporaryUpload,
} from '../controllers/CloudinaryController';
import { requireAuth } from '../middlewares/AuthMiddleware';

const router = express.Router();

router.post('/generate-signature', handleGenerateSignature);
router.post('/generate-signature-video', handleGenerateSignatureVideo);
router.post('/generate-signature-to-delete-video', handleGenerateSignatureDeleteVideo);
router.post('/api/cloudinary/signature', requireAuth, handleGenerateSignature);
router.post('/api/cloudinary/video-signature', requireAuth, handleGenerateSignatureVideo);
router.post('/api/cloudinary/video-delete-signature', requireAuth, handleGenerateSignatureDeleteVideo);
router.post('/api/cloudinary/verification-signature', requireAuth, handleGenerateVerificationUploadSignature);
router.post('/api/cloudinary/temporary-upload', requireAuth, handleRegisterTemporaryUpload);
router.post('/api/cloudinary/temporary-upload/deleted', requireAuth, handleMarkTemporaryUploadDeleted);

export default router;
