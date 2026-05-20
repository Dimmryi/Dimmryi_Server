import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { createApp } from './app';
import setupChatSocket from './socket/chatSocket';

dotenv.config();

const requiredEnvVars = ['MONGO_DB', 'JWT_SECRET', 'COOKIE_SECRET', 'GOOGLE_CLIENT_ID'];
for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        throw new Error(`Missing required environment variable: ${varName}`);
    }
}

const port = Number(process.env.PORT) || 5000;

const sessionStore = MongoStore.create({
    mongoUrl: process.env.MONGO_DB,
    ttl: 7 * 24 * 60 * 60,
});

const app = createApp(sessionStore);

mongoose.connect(process.env.MONGO_DB!)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
        process.exit(1);
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
