import express, {Request, Response, Application, NextFunction} from 'express';
import mongoose from 'mongoose';
import ngrok from '@ngrok/ngrok';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import bcrypt from "bcryptjs";
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import session, {SessionData} from 'express-session';
import MongoStore from 'connect-mongo';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import listingRoutes from './routes/ListingRoutes';
import ListingModel from "./models/ListingModel";
import 'express-session';
import dotenv from 'dotenv';
import User from "./models/UserModel";
import UserRoutes from './routes/UserRoutes';
import CommentModel from "./models/CommentModel";
import CommentsRoutes from "./routes/CommentsRoutes";
import AgentModel from "./models/AgentModel";
import AgentsRoutes from "./routes/AgentsRoutes";
import AdsModel from "./models/AdsModel";
import ListingRoutes from "./routes/ListingRoutes";
import NotificationModel from "./models/NotificationModel";
import haversine from 'haversine-distance';
import { getNextListingNumber } from './utils/getNextListingNumber';
import sendNotificationEmail  from './emailService';
import { v2 as cloudinary } from 'cloudinary';
dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_DB = process.env.MONGO_DB;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const COOKIE_SECRET = process.env.COOKIE_SECRET;
const CLOUD_NAME = process.env.CLOUD_NAME;
const SECRET = process.env.SECRET_TOKEN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;

const client = new OAuth2Client(GOOGLE_CLIENT_ID);
const app = express();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

declare module 'express-session' {
    interface SessionData {
        user?: {
            id: string;
            name: string;
            email: string;
            preferredContact?: string;
            contact?: string;
            role?: string;
            authMethod?: string;
        };
    }
}

declare module 'express' {
    interface Request {
        session: session.Session & Partial<session.SessionData>;
    }
}

// Google Token Verification Function
async function verifyGoogleToken(token: string) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
}

export const authenticateJWT = (req:any, res:any, next:any) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET || "", (err:any, user:any) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Protected route
app.get('/api/protected', authenticateJWT, (req:any, res:any) => {
    res.json({ message: `Hello ${req.user?.userId}` });
});

// Generating a JWT token
function generateSessionToken(userId: string) {
    return jwt.sign({ userId }, JWT_SECRET || "", { expiresIn: '1h' });
}

// Middleware
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:5173', // Allowing requests from the front
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));

// General middleware for authorization checking
// const checkAuth = (req:any, res:any, next: NextFunction) => {
//     if (!req.session.user) {
//         return res.status(401).json({ message: "Not authenticated" });
//     }
//     next();
// };

// Setting up sessions
app.use(session({
    secret: `${COOKIE_SECRET}`,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_DB,
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: true, // true only with HTTPS //!!!!!!!!!!!!!!!!!! Change to "true" before uploading to production!!!
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 1 Day of a cookie's life
        sameSite: 'lax',
    },
}));

// MongoDB Connection
mongoose.connect(`${MONGO_DB}`)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Error connecting to MongoDB:', err);
    });

// Keys to LiqPay (you need to register to receive them!)
const PUBLIC_KEY = 'your_public_key';
const PRIVATE_KEY = 'your_private_key';

// Generating a payment form Google Pay
app.get('/api/pay', async (req, res) => {
    const liqpayData = {
        public_key: PUBLIC_KEY,
        version: 3,
        action: 'subscribe', // subscription
        amount: 100, // price in UAH
        currency: 'UAH',
        description: 'Підписка на розсилку сповіщень',
        subscribe_periodicity: 'month',
        subscribe_date_start: new Date().toISOString().slice(0, 10),
        pay_types: 'gpay', // only Google Pay
        result_url: 'https://your-frontend-site.com/payment-success', // where the user will return
        server_url: 'https://your-ngrok-url/api/liqpay/callback', // server callback
    };

    const data = Buffer.from(JSON.stringify(liqpayData)).toString('base64');
    const signature = crypto
        .createHash('sha1')
        .update(PRIVATE_KEY + data + PRIVATE_KEY)
        .digest('base64');

    res.json({
        data,
        signature
    });
});

// Callback от LiqPay
app.post('/api/liqpay/callback', (req, res) => {
    console.log('Callback data:', req.body);

    // The signature needs to be checked here.
    const receivedSignature = req.body.signature;
    const calculatedSignature = crypto
        .createHash('sha1')
        .update(PRIVATE_KEY + req.body.data + PRIVATE_KEY)
        .digest('base64');

    if (receivedSignature === calculatedSignature) {
        const paymentInfo = JSON.parse(Buffer.from(req.body.data, 'base64').toString('utf8'));
        console.log('Payment info:', paymentInfo);

        if (paymentInfo.status === 'success') {
            // Updating the user's subscription status in the database
            console.log('Subscription paid successfully!');
        }
    }

    res.sendStatus(200);
});

app.post('/api/listingsWithComparison', async (req, res) => {
    try {
        const listingNumber = await getNextListingNumber();
        const newListing = new ListingModel({
            ...req.body,
            listingNumber,
            date: Date.now(),
        });

        await newListing.save();

        const notifications = await NotificationModel.find({
            listingType:  newListing.listingType,
            propertyType: newListing.propertyType,
            typeOfNovelty: newListing.typeOfNovelty,
            minPrice: {$lte: newListing.price},
            maxPrice: {$gte: newListing.price},
            minNumbersOfRoom: {$lte: newListing.numbersOfRooms},
            maxNumbersOfRoom: {$gte: newListing.numbersOfRooms},
            minTotalArea: {$lte: newListing.totalArea},
            maxTotalArea: {$gte: newListing.totalArea},
            minFloor: {$lte: newListing.numberOfFloor},
            maxFloor: {$gte: newListing.numberOfFloor},
        });

        let distance
        const matchedNotifications = notifications.filter((notification) => {
            const listingCoords = {
                lat: newListing.lat || 50,
                lon: newListing.lon || 36,
            };
            const notifCoords = {
                lat: notification.lat || 50,
                lon: notification.lon || 36,
            };
            distance = haversine(listingCoords, notifCoords); // в метрах
            return distance <= notification.locationRange * 1000;
        });

        for (const match of matchedNotifications) {
            const { email } = match;

            await sendNotificationEmail(
                email,
                'New listing matches your preferences',
                `A new property listing matches your preferences:
                Price: ${newListing.price}\nType of advertisement: ${newListing.listingType}
                Number of rooms: ${newListing.numbersOfRooms}\nTotal area: ${newListing.totalArea}
                Number of floor: ${newListing.numberOfFloor}\nDistance to the desired point: ${distance}
                Visit the site to view it.`
            );
        }
        res.status(201).json({ message: 'Listing created and notifications sent.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error saving listing or sending notifications.' });
    }
});

app.post('/saveImageUrl', async (req, res) => {
    try{
        const { imageUrl } = req.body;
        const image = new ListingModel({ imageUrl });
        await image.save();
        res.status(200).send('Image URL saved');
    }catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/check-auth', async (req, res) => {
    if (req.session.user) {
        res.json({
            isAuthenticated: true,
            user: req.session.user,
            id: req.session.id.toString(),
        });
    } else {
        res.json({
            isAuthenticated: false
        });
    }
});

app.get('/api/ads', async (req, res) => {
    try{
        const ads = await AdsModel.find();
        res.json(ads);
    }catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/ads', async (req, res) => {
    try{
        const {publicId, adsString, ownerName, videoUrl} = req.body;
        const newAds = new AdsModel({
            publicId,
            adsString,
            ownerName,
            videoUrl,
            dateUpload: `${Date.now()}`,
            isFeatured: false,
        });
        await newAds.save();
        res.status(201).json({ message: `Advertisement saved successfully!`});
    }catch (error) {
        res.status(500).json({ error: 'Error saved advertisement.' });
    }
});

// Set featured ad by ID (only for admin)
app.post('/api/ads/set-featured', async (req:any, res:any) => {
    const { adId } = req.body;
    try {
        // Reset all previous
        await AdsModel.updateMany({ isFeatured: true }, { isFeatured: false });
        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ message: `Invalid ID format: ${adId}` });
        }
        const objectId = new mongoose.Types.ObjectId(adId);
        // Set new as active
        await AdsModel.findByIdAndUpdate(objectId, { isFeatured: true });

        res.status(200).json({ message: 'Featured ad updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set featured ad' });
    }
});

app.post('/api/ads/modified-string', async (req:any, res:any) => {
    const { adId, modifiedString } = req.body;
    try {
        if (!mongoose.Types.ObjectId.isValid(adId)) {
            return res.status(400).json({ message: `Invalid ID format: ${adId}` });
        }
        const objectId = new mongoose.Types.ObjectId(adId);

        await AdsModel.findByIdAndUpdate(objectId, { adsString: modifiedString });

        res.status(200).json({ message: 'Featured ad updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set featured ad' });
    }
});

app.get('/api/ads/featured', async (req:any, res:any) => {
    try {
        const ad = await AdsModel.findOne({ isFeatured: true });

        if (!ad) {
            return res.status(404).json({ message: 'No featured ad found' });
        }

        res.json(ad);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch featured ad' });
    }
});

app.delete('/api/ads/:publicId', async (req:any, res:any) => {
    try{
        const { publicId } = req.params;
        const deletedVideoUrl = await AdsModel.deleteMany({ publicId : `${publicId}` });
        if (deletedVideoUrl.deletedCount === 0) {
            return res.status(404).json({ message: 'No Ads data found.' });
        }

        res.status(200).json({
            message: `Successfully deleted ads.`,
            deletedCount: deletedVideoUrl.deletedCount,
        });
    }catch (error) {
        res.status(500).json({ error: 'Error delete advertisement.' });
    }
});

app.get('/api/notifications', async (req, res) => {
    try {
        const notifications = await NotificationModel.find();
           res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Error send notification.' });
    }
});

app.get('/api/notification/:notificationId', async (req:any, res:any) => {
    try {
        const { notificationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ message: `Invalid ID format: ${notificationId}` });
        }
        const objectId = new mongoose.Types.ObjectId(notificationId);
        const notification = await NotificationModel.findById(objectId);
        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Error send notification.' });
    }
});

app.get('/api/notifications/authorId/:userId', async (req, res) => {
    try {
        const notification = await NotificationModel.find({ userId: req.params.userId });
           if (!notification) {
               res.status(404).json({ message: 'Notification not found' });
               return
           }
           res.json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Error send notification.' });
    }
});

app.post('/api/notification', async (req, res) => {
    try {
        const {listingType, propertyType, typeOfNovelty, minNumbersOfRoom, maxNumbersOfRoom, minTotalArea,
            maxTotalArea, minFloor, maxFloor, minPrice, maxPrice, locationSought, locationRange, email, userId, lat, lon} = req.body;

        const currentUserId = req.session.user?.id;
        const currentEmail = req.session.user?.email;

        const newNotification = new NotificationModel({listingType, propertyType, typeOfNovelty, minNumbersOfRoom, maxNumbersOfRoom,
            minTotalArea, maxTotalArea, minFloor, maxFloor, minPrice, maxPrice, locationSought, locationRange,lat , lon,
            userId: userId ? userId : `${currentUserId}`, email: email ? `${email}` : `${currentEmail}`, date: Date.now(),
        });
        await newNotification.save();

        res.status(201).json({ message: `Notification saved successfully!`});
        } catch (error) {
        res.status(500).json({ error: 'Error saved notification.' });
    }
});

app.put('/api/notification/:notificationId', async (req, res: any) => {
    try {
        const { notificationId } = req.params;
        const updatedData = req.body;

        const objectId = new mongoose.Types.ObjectId(notificationId);
        const existingNotification = await NotificationModel.findById(objectId);

        if (!existingNotification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const currentUserId = req.session.user?.id;
        const currentUserName = req.session.user?.name;
        const currentUserRole = req.session.user?.role;

        // Check access rights (the ad owner must match the current user)
        if (existingNotification.userId !== currentUserId && currentUserRole !== 'admin') {
            return res.status(403).json({message: `Unauthorized access. You must be the owner  or an admin to edit this notification.`});
        }

        const allowedUpdates = {
            listingType: updatedData.listingType,
            propertyType: updatedData.propertyType,
            typeOfNovelty: updatedData.typeOfNovelty,
            minNumbersOfRoom: updatedData.minNumbersOfRoom,
            maxNumbersOfRoom: updatedData.maxNumbersOfRoom,
            minTotalArea: updatedData.minTotalArea,
            maxTotalArea: updatedData.maxTotalArea,
            minFloor: updatedData.minFloor,
            maxFloor: updatedData.maxFloor,
            minPrice: updatedData.minPrice,
            maxPrice: updatedData.maxPrice,
            locationSought :updatedData.locationSought,
            locationRange :updatedData.locationRange,
            lat :updatedData.lat,
            lon: updatedData.lon,
            email :updatedData.email,
            date: Date.now()
        };

        const updatedNotification = await NotificationModel.findByIdAndUpdate(
            objectId,
            { $set: allowedUpdates },
            { new: true, runValidators: true }
        );

         res.json(updatedNotification);

    } catch (error) {
        console.error('Error updating Notification:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/notifications/:notificationId', async (req:any, res:any) => {
    try {
        const { notificationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
         return res.status(400).json({ message: `Invalid ID format: ${notificationId}` });
        }

        const objectId = new mongoose.Types.ObjectId(notificationId);

        const deletedNotification = await NotificationModel.deleteMany({ _id: objectId });

        if (deletedNotification.deletedCount === 0) {
         return res.status(404).json({ message: 'No Notification data found.' });
        }

        res.status(200).json({
         message: `Successfully deleted notification.`,
         deletedCount: deletedNotification.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ error: 'Error saved notification.' });
    }
});

app.post('/login', async (req:any , res:any): Promise<void>  => {
    try {
        const { email, password, authMethod } = req.body

        // Searching for a user in the database
        const user:any = await User.findOne({ email });

        if (!user) {
            res.status(401).json({ message: "Invalid credentials" });
            return;
        }
        // Checking the authentication method
        if (user.authMethod !== authMethod) {
            res.status(409).json({
                message: `User registered with ${user.authMethod}`,
                authMethod: user.authMethod
            });
            return;
        }
        // For standard authentication, we check the password
        if (authMethod === 'password') {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                res.status(401).json({ message: "Invalid password"  });  // "Invalid credentials"
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

        res.json({
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                authMethod: user.authMethod,
            }
        });

        await req.session.save();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Endpoint for Google authentication
app.post('/api/auth/google', async (req:any, res:any) => {
    try {
        const { token: googleToken } = req.body;
        // Token verification
        // const ticket = await client.verifyIdToken({
        //     idToken: googleToken,
        //     audience: process.env.GOOGLE_CLIENT_ID
        // });
        const payload = await verifyGoogleToken(googleToken);

        if (!payload) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        // Search for a user by Google ID
        let user = await User.findOne({
            $or: [
                { googleId: payload.sub },
                { email: payload.email } // In case the user changed login methods
            ]
        });

        // Creating a new user on first login
        if (!user) {
            user = new User({
                name: payload.name || '',
                email: payload.email || '',
                googleId: payload.sub,
                authMethod: 'google',
            });
            await user.save();
        }

        // Creating a session token
        const sessionToken = generateSessionToken(user._id.toString());

        res.json({
            success: true,
            token: sessionToken,
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                authMethod: 'google',
            }
        });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Session check
app.get('/session', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user, message:'Session is active' });
    } else {
        res.status(401).json({ message: 'No active session' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid'); // Clearing cookies
        res.json({ message: 'Logged out' });
    });
});

// Cloudinary routes
app.post("/generate-signature", (req, res) => {
    const { public_id, timestamp } = req.body;
    const stringToSign = `public_id=${public_id}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(stringToSign).digest("hex");
    res.json({ signature, timestamp, api_key: CLOUDINARY_API_KEY });
});

app.post('/generate-signature-to-delete-video', (req, res) => {
    const { public_id, timestamp } = req.body;

    const signature = cloudinary.utils.api_sign_request(
        { public_id, timestamp },
        process.env.CLOUDINARY_API_SECRET || ""
    );

    res.json({
        signature,
        timestamp,
        api_key: cloudinary.config().api_key,
    });
});

app.post("/generate-signature-video", (req, res) => {
    const { public_id, timestamp } = req.body;

    const paramsToSign = {
        public_id,
        timestamp,
        resource_type: 'video',
    };

    const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET || ""
    );

    res.json({
        signature,
        timestamp,
        api_key: process.env.CLOUDINARY_API_KEY,
    });
});

app.use(UserRoutes);
app.use(ListingRoutes);
app.use(AgentsRoutes);
app.use(CommentsRoutes);

//Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
