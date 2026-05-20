import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import { createServer } from 'http';
import { Server } from 'socket.io';

import AuthRoutes from './routes/AuthRoutes';
import ListingRoutes from './routes/ListingRoutes';
import UserRoutes from './routes/UserRoutes';
import CommentsRoutes from './routes/CommentsRoutes';
import AgentsRoutes from './routes/AgentsRoutes';
import NotificationRoutes from './routes/NotificationRoutes';
import ChatRoutes from './routes/ChatRoutes';
import AdsRoutes from './routes/AdsRoutes';
import CloudinaryRoutes from './routes/CloudinaryRoutes';
import setupChatSocket from './socket/chatSocket';

dotenv.config();

const requiredEnvVars = ['MONGO_DB', 'JWT_SECRET', 'COOKIE_SECRET', 'GOOGLE_CLIENT_ID'];
for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
    }
}

const port = Number(process.env.PORT) || 5000;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// Required for secure cookies behind Render's reverse proxy
app.set('trust proxy', 1);

app.use(cors({
    //origin: process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
     origin: ["http://localhost:5173", "http://127.0.0.1:5173"], // Vite dev server
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
    secret: process.env.COOKIE_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_DB,
        ttl: 7 * 24 * 60 * 60,
    }),
    cookie: {
        secure: true,
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        sameSite: 'none',
    },
}));

mongoose.connect(process.env.MONGO_DB!)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
    });

app.use(AuthRoutes);
app.use(ListingRoutes);
app.use(UserRoutes);
app.use(CommentsRoutes);
app.use(AgentsRoutes);
app.use(NotificationRoutes);
app.use(ChatRoutes);
app.use(AdsRoutes);
app.use(CloudinaryRoutes);

app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.get('/version', (_req, res) => {
    res.json({ version: '2026-05-12-001', timestamp: new Date().toISOString(), commit: process.env.RENDER_GIT_COMMIT });
});

app.get('/api/test', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString(), message: 'Test endpoint is working!' });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
    },
});

setupChatSocket(io);

httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
});

const gracefulShutdown = () => {
    httpServer.close(() => {
        mongoose.connection.close();
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
