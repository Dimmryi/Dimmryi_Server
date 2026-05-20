import express from 'express';
import {
    handleLogin,
    handleGoogleAuth,
    handleGetSession,
    handleLogout,
    handleForgotPassword,
    handleValidateResetToken,
    handleResetPassword,
} from '../controllers/AuthController';

const router = express.Router();

router.post('/login', handleLogin);
router.post('/api/auth/google', handleGoogleAuth);
router.get('/session', handleGetSession);
router.post('/logout', handleLogout);
router.post('/api/auth/forgot-password', handleForgotPassword);
router.get('/api/auth/reset-password/validate', handleValidateResetToken);
router.post('/api/auth/reset-password', handleResetPassword);

export default router;
