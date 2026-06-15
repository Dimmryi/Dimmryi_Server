import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import session, { Store } from 'express-session';
import { v2 as cloudinary } from 'cloudinary';

import AuthRoutes from './routes/AuthRoutes';
import ListingRoutes from './routes/ListingRoutes';
import UserRoutes from './routes/UserRoutes';
import CommentsRoutes from './routes/CommentsRoutes';
import AgentsRoutes from './routes/AgentsRoutes';
import NotificationRoutes from './routes/NotificationRoutes';
import ChatRoutes from './routes/ChatRoutes';
import AdsRoutes from './routes/AdsRoutes';
import CloudinaryRoutes from './routes/CloudinaryRoutes';
import SubscribeRoutes from './routes/SubscribeRoutes';
import FavoriteRoutes from './routes/FavoriteRoutes';
import VerificationRoutes from './routes/VerificationRoutes';
import PriceAnalyticsRoutes from './routes/PriceAnalyticsRoutes';
import ExchangeRateRoutes from './routes/ExchangeRateRoutes';
import PromotionRequestRoutes from './routes/PromotionRequestRoutes';
import AiEstimatorRoutes from './routes/AiEstimatorRoutes';
import { getAllowedOrigins, isAllowedOrigin } from './config/cors';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export function createApp(sessionStore?: Store) {
    const app = express();
    const allowedOrigins = getAllowedOrigins();

    app.set('trust proxy', 1);

    app.use(cors({
        origin: (origin, callback) => {
            if (isAllowedOrigin(origin, allowedOrigins)) {
                callback(null, true);
            } else {
                callback(new Error(`CORS blocked: ${origin}`));
            }
        },
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    }));

    app.use(express.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());

    app.use(session({
        secret: process.env.COOKIE_SECRET || 'test-secret',
        resave: false,
        saveUninitialized: false,
        store: sessionStore,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 * 7,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        },
    }));

    app.use(AuthRoutes);
    app.use(ListingRoutes);
    app.use(UserRoutes);
    app.use(CommentsRoutes);
    app.use(AgentsRoutes);
    app.use(NotificationRoutes);
    app.use(ChatRoutes);
    app.use(AdsRoutes);
    app.use(CloudinaryRoutes);
    app.use(SubscribeRoutes);
    app.use(FavoriteRoutes);
    app.use(VerificationRoutes);
    app.use(PriceAnalyticsRoutes);
    app.use(ExchangeRateRoutes);
    app.use(PromotionRequestRoutes);
    app.use(AiEstimatorRoutes);

    app.get('/healthz', (req, res) => {
        res.json({ status: 'ok', message: 'Server is running' });
    });

    app.get('/version', (req, res) => {
        res.json({ version: '2026-05-12-001', timestamp: new Date().toISOString(), commit: process.env.RENDER_GIT_COMMIT });
    });

    app.get('/api/test', (req, res) => {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), message: 'Test endpoint is working!' });
    });

    return app;
}
