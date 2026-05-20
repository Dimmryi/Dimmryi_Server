import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Request, Response } from 'express';
import User from '../models/UserModel';
import { sendNotificationEmail } from '../emailService';

const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token: string) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
}

function generateSessionToken(userId: string) {
    return jwt.sign({ userId }, process.env.JWT_SECRET || '', { expiresIn: '1h' });
}

export const handleLogin = async (req: any, res: any): Promise<void> => {
    try {
        const { email, password, authMethod } = req.body;
        const user: any = await User.findOne({ email });

        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }

        if (user.authMethod !== authMethod) {
            res.status(409).json({ message: `User registered with ${user.authMethod}`, authMethod: user.authMethod });
            return;
        }

        if (authMethod === 'password') {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                res.status(401).json({ message: 'Invalid password' });
                return;
            }
        }

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            authMethod: user.authMethod,
        };
        await req.session.save();

        res.json({
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                authMethod: user.authMethod,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGoogleAuth = async (req: any, res: any) => {
    try {
        const { token: googleToken } = req.body;
        const payload = await verifyGoogleToken(googleToken);

        if (!payload) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        let user = await User.findOne({
            $or: [{ googleId: payload.sub }, { email: payload.email }],
        });

        if (user && user.authMethod === 'password') {
            return res.status(409).json({
                message: 'This email is registered with password. Please log in with password.',
                email: user.email,
            });
        }

        if (!user) {
            user = new User({
                name: payload.name || '',
                email: payload.email || '',
                googleId: payload.sub,
                authMethod: 'google',
            });
            await user.save();
        }

        req.session.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            authMethod: 'google',
        };
        await req.session.save();

        const sessionToken = generateSessionToken(user._id.toString());

        res.json({
            success: true,
            message: 'Google authentication successful',
            token: sessionToken,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                authMethod: 'google',
            },
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

export const handleGetSession = (req: any, res: any) => {
    if (req.session.user) {
        res.json({ user: req.session.user.name, expires: req.session.cookie.expires, message: 'Session is active' });
    } else {
        res.status(401).json({ message: 'No active session' });
    }
};

export const handleLogout = (req: Request, res: Response) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
};

export const handleForgotPassword = async (req: any, res: any) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ message: 'Email is required.' });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });

        if (!user) {
            return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
        }

        if (user.authMethod === 'google') {
            await sendNotificationEmail({
                to: user.email,
                subject: 'Інформація про ваш акаунт — Дім мрії App',
                html: `<h1>Привіт, ${user.name}!</h1>
                <p>Ви запросили скидання пароля, але ваш акаунт підключено через Google.</p></br>
                <p>Для входу натисніть кнопку "Увійти через Google" на сторінці авторизації.</p></br>
                <p>Якщо ви не робили цей запит — проігноруйте цей лист.</p></br>
                <p>З повагою,</p></br>
                <p>Команда Дім мрії App</p>`,
            });
            return res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

        await User.findByIdAndUpdate(user._id, {
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
        });

        const frontendUrl = process.env.ALLOWED_ORIGINS || 'http://localhost:5173';
        const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

        await sendNotificationEmail({
            to: user.email,
            subject: 'Скидання пароля — Дім мрії App',
            html: `<h1>Привіт, ${user.name}!</h1>
            <p>Ми отримали запит на скидання пароля для вашого акаунту.</p></br>
            <p>Натисніть на посилання нижче або скопіюйте його у браузер:</p></br>
            <b>${resetUrl}</b></br>
            <p>⏱ Посилання дійсне протягом 30 хвилин.</p></br>
            <p>Якщо ви не запитували скидання пароля — просто проігноруйте цей лист.</p></br>
            <p>Ваш пароль залишиться без змін.</p></br>
            <p>З повагою,</p></br>
            <p>Команда Дім мрії App</p>`,
        });

        res.status(200).json({ message: 'If this email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
};

export const handleValidateResetToken = async (req: any, res: any) => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            return res.status(400).json({ message: 'Token is required.' });
        }

        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(410).json({ message: 'Reset link has expired or already been used.' });
        }

        res.status(200).json({ message: 'Token is valid.' });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({ error: 'Server error.' });
    }
};

export const handleResetPassword = async (req: any, res: any) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: 'Token and password are required.' });
        }

        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: new Date() },
        });

        if (!user) {
            return res.status(410).json({ message: 'Reset link has expired or already been used.' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await User.findByIdAndUpdate(user._id, {
            password: hashedPassword,
            authMethod: 'password',
            passwordResetToken: null,
            passwordResetExpires: null,
        });

        await sendNotificationEmail({
            to: user.email,
            subject: 'Пароль успішно змінено — Дім мрії App',
            html: `<h2>Привіт, ${user.name}!</h2>
            <p>Ваш пароль на Real Estate App було успішно змінено.</p></br>
            <p>Якщо ви не робили цю зміну — негайно зв'яжіться з нами, відповівши на цей лист.</p></br>
            <p>З повагою,</p>
            <p>Команда Дім мрії App</p>`,
        });

        res.status(200).json({ message: 'Password successfully updated.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
};
