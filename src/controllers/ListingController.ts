import { Request, Response } from 'express';
import mongoose from 'mongoose';
import haversine from 'haversine-distance';
import Listing from '../models/ListingModel';
import NotificationModel from '../models/NotificationModel';
import NotificationEmailLogModel from '../models/NotificationEmailLogModel';
import User from '../models/UserModel';
import { getNextListingNumber } from '../utils/getNextListingNumber';
import { sendNotificationEmail } from '../emailService';

const MAX_NOTIFICATION_EMAILS_PER_DAY = 4;
const NOTIFICATION_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalizeStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }

    return typeof value === 'string' && value.trim() !== '' ? [value] : [];
};

const hasActiveNotificationSubscription = (user: any) =>
    (user.subscribeType === 'Standard' || user.subscribeType === 'Premium') &&
    Boolean(user.subscribeExpired) &&
    new Date(user.subscribeExpired as Date).getTime() > Date.now();

const toNumber = (value: unknown) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
};

const hasUsableCoords = (lat: unknown, lon: unknown) => {
    const latNumber = Number(lat);
    const lonNumber = Number(lon);
    return Number.isFinite(latNumber) && Number.isFinite(lonNumber) && !(latNumber === 0 && lonNumber === 0);
};

const buildNotificationQuery = (listing: any) => ({
    listingType: listing.listingType,
    propertyType: listing.propertyType,
    typeOfNovelty: listing.typeOfNovelty,
    minPrice: { $lte: toNumber(listing.price) },
    maxPrice: { $gte: toNumber(listing.price) },
    minNumbersOfRoom: { $lte: toNumber(listing.numbersOfRooms) },
    maxNumbersOfRoom: { $gte: toNumber(listing.numbersOfRooms) },
    minTotalArea: { $lte: toNumber(listing.totalArea) },
    maxTotalArea: { $gte: toNumber(listing.totalArea) },
    minFloor: { $lte: toNumber(listing.numberOfFloor) },
    maxFloor: { $gte: toNumber(listing.numberOfFloor) },
});

const listingTypeLabel = (value: unknown) => value === 'rent' ? 'Оренда' : 'Продаж';

const propertyTypeLabel = (value: unknown) => {
    if (value === 'flat') return 'Квартира';
    if (value === 'private house') return 'Приватний будинок';
    if (value === 'commercial real estate') return 'Комерційна нерухомість';
    return 'Нерухомість';
};

const buildNotificationEmailHtml = (listing: any, distance: number) => {
    const detailsUrl = `${process.env.ALLOWED_ORIGINS || ''}/details/${listing.id}`;
    const rows = [
        ['Тип оголошення', listingTypeLabel(listing.listingType)],
        ['Тип обʼєкта', propertyTypeLabel(listing.propertyType)],
        ['Ціна', `${listing.price}`],
        ['Кількість кімнат', `${listing.numbersOfRooms || 'не вказано'}`],
        ['Загальна площа', listing.totalArea ? `${listing.totalArea} м²` : 'не вказано'],
        ['Поверх', listing.numberOfFloor ? `${listing.numberOfFloor}` : 'не вказано'],
        ['Адреса', listing.location || 'не вказано'],
        ['Відстань до бажаної точки', `${distance} м`],
    ];

    return `
        <div style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
            <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
                <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                    <div style="background:#0f2f57;padding:24px 28px;color:#ffffff;">
                        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#f5a623;">Дім мрії</p>
                        <h1 style="margin:0;font-size:24px;line-height:1.25;font-weight:700;">Знайдено нове оголошення за вашими критеріями</h1>
                    </div>
                    <div style="padding:24px 28px;">
                        <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">
                            Ми знайшли новий обʼєкт, який відповідає параметрам вашого сповіщення.
                        </p>
                        <table style="width:100%;border-collapse:collapse;margin:0 0 22px;">
                            <tbody>
                                ${rows.map(([label, value]) => `
                                    <tr>
                                        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${label}</td>
                                        <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${value}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <a href="${detailsUrl}" style="display:inline-block;background:#f5a623;color:#1a0f02;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 18px;">
                            Переглянути оголошення
                        </a>
                        <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#64748b;">
                            Для одного email діє ліміт до 4 таких сповіщень за 24 години.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export const handleGetListings = async (req: any, res: Response) => {
    try {
        const listings = await Listing.find().lean();
        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Reserved for future use when the project scales and pagination becomes necessary.
export const handleGetListingsWithPagination = async (req: any, res: Response) => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
        const skip = (page - 1) * limit;

        const [listings, total] = await Promise.all([
            Listing.find().skip(skip).limit(limit).lean(),
            Listing.countDocuments(),
        ]);

        res.json({ listings, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingsById = async (req: any, res: any) => {
    try {
        const listing = await Listing.find({ _id: req.params.id });
        if (!listing) {
            res.status(404).json({ message: 'Listing not found' });
            return;
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingById = async (req: any, res: any) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            res.status(404).json({ message: 'Listing not found' });
            return;
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingsByOwnerId = async (req: any, res: any) => {
    try {
        const listing = await Listing.find({ ownerId: req.params.userId });
        if (!listing) {
            res.status(404).json({ message: 'Listing not found' });
            return;
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingsByUserName = async (req: any, res: any) => {
    try {
        const listings = await Listing.find({ owner: req.params.userName });
        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostListings = async (req: any, res: any) => {
    try {
        const { image, video, ...rest } = req.body;
        const listing = new Listing({
            ...rest,
            image: normalizeStringArray(image),
            video: normalizeStringArray(video),
        });
        await listing.save();
        res.json({ message: 'Listing added with multiple images!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostListingsWithComparison = async (req: Request, res: Response) => {
    try {
        const listingNumber = await getNextListingNumber();
        const { image, video, videoUrl, ...rest } = req.body;
        const normalizedVideo = normalizeStringArray(video);
        const newListing = new Listing({
            ...rest,
            image: normalizeStringArray(image),
            video: normalizedVideo.length ? normalizedVideo : normalizeStringArray(videoUrl),
            listingNumber,
            date: Date.now(),
        });
        await newListing.save();

        const notifications = await NotificationModel.find(buildNotificationQuery(newListing));

        const listingCoords = hasUsableCoords(newListing.lat, newListing.lon)
            ? { lat: Number(newListing.lat), lon: Number(newListing.lon) }
            : null;

        const matchedNotifications = listingCoords ? notifications.filter((n) => {
            if (!hasUsableCoords(n.lat, n.lon)) return false;
            const distance = haversine(listingCoords, { lat: Number(n.lat), lon: Number(n.lon) });
            return distance <= n.locationRange * 1000;
        }) : [];

        if (!listingCoords) {
            res.status(201).json({
                message: 'Listing created without notification matching because coordinates are missing.',
                listing: newListing,
            });
            return;
        }

        for (const match of matchedNotifications) {
            if (!match.userId || !match.email) continue;

            const notificationOwner = await User.findById(match.userId);
            if (!notificationOwner || !hasActiveNotificationSubscription(notificationOwner)) continue;

            const normalizedEmail = String(match.email).trim().toLowerCase();
            const sentToday = await NotificationEmailLogModel.countDocuments({
                email: normalizedEmail,
                sentAt: { $gte: new Date(Date.now() - NOTIFICATION_EMAIL_WINDOW_MS) },
            });

            if (sentToday >= MAX_NOTIFICATION_EMAILS_PER_DAY) continue;

            const distance = Math.round(haversine(listingCoords, { lat: Number(match.lat), lon: Number(match.lon) }));
            await sendNotificationEmail({
                to: normalizedEmail,
                subject: 'Нове оголошення за вашими критеріями',
                html: buildNotificationEmailHtml(newListing, distance),
            });

            await NotificationEmailLogModel.create({
                email: normalizedEmail,
                notificationId: match._id?.toString(),
                listingId: newListing._id?.toString(),
                sentAt: new Date(),
            });
        }

        res.status(201).json({
            message: 'Listing created and notifications sent.',
            listing: newListing,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateListingById = async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const existingListing = await Listing.findById(id);

        if (!existingListing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        const currentUserId = req.session.user?.id;
        const currentUserName = req.session.user?.name;
        const currentUserRole = req.session.user?.role;

        if (existingListing.owner !== currentUserName && currentUserRole !== 'admin' && existingListing.ownerId !== currentUserId) {
            return res.status(403).json({ message: `Unauthorized. You must be the owner or an admin.` });
        }

        const allowedUpdates: Record<string, unknown> = {
            apartmentDetails: updatedData.apartmentDetails,
            description: updatedData.description,
            contact: updatedData.contact,
            price: updatedData.price,
            location: updatedData.location,
            listingType: updatedData.listingType,
            propertyType: updatedData.propertyType,
            typeOfNovelty: updatedData.typeOfNovelty,
            numbersOfRooms: updatedData.numbersOfRooms,
            totalArea: updatedData.totalArea,
            numberOfFloor: updatedData.numberOfFloor,
            numberOfStoreysOfBuilding: updatedData.numberOfStoreysOfBuilding,
            lat: updatedData.lat,
            lon: updatedData.lon,
            date: Date.now(),
            qualityOfRenovation: updatedData.qualityOfRenovation,
        };

        if (updatedData.image !== undefined) {
            allowedUpdates.image = normalizeStringArray(updatedData.image);
        }

        if (updatedData.video !== undefined || updatedData.videoUrl !== undefined) {
            const normalizedVideo = normalizeStringArray(updatedData.video);
            allowedUpdates.video = normalizedVideo.length ? normalizedVideo : normalizeStringArray(updatedData.videoUrl);
        }

        const updatedListing = await Listing.findByIdAndUpdate(
            id,
            { $set: allowedUpdates },
            { new: true, runValidators: true }
        );

        res.json(updatedListing);
    } catch (error) {
        console.error('Error updating listing:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteListingById = async (req: any, res: any) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: `Invalid ID format: ${id}` });
        }

        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).json({ message: 'No listings found by ID.' });
        }

        const isAdmin = req.session.user?.role === 'admin';
        const isOwner = req.session.user?.id === listing.ownerId;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await listing.deleteOne();
        res.status(200).json({ message: 'Listing deleted.', deletedCount: 1 });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ message: 'Failed to delete listing.' });
    }
};

export const handleDeleteListingByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        const deleted = await Listing.deleteMany({ ownerId: userId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'No listings found for this user.' });
        }

        res.status(200).json({ message: 'Listings deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        console.error('Error deleting listings by user ID:', error);
        res.status(500).json({ message: 'Failed to delete listings.' });
    }
};

export const handleDeleteListingByUserName = async (req: any, res: any) => {
    try {
        const { userName } = req.params;
        const deleted = await Listing.deleteMany({ owner: userName });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'No listings found for this user.' });
        }

        res.status(200).json({ message: 'Listings deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        console.error('Error deleting listings by username:', error);
        res.status(500).json({ message: 'Failed to delete listings.' });
    }
};

export const handleDeleteLastListing = async (req: any, res: any) => {
    try {
        const lastListing = await Listing.findOne().sort({ _id: -1 });

        if (!lastListing) {
            return res.status(404).json({ message: 'No listings found.' });
        }

        await Listing.findByIdAndDelete(lastListing._id);
        res.status(200).json({ message: 'Last listing deleted.', deletedListing: lastListing });
    } catch (error) {
        console.error('Error deleting last listing:', error);
        res.status(500).json({ message: 'Failed to delete last listing.' });
    }
};
