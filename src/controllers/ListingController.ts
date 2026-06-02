import { Request, Response } from 'express';
import mongoose from 'mongoose';
import haversine from 'haversine-distance';
import Listing from '../models/ListingModel';
import NotificationModel from '../models/NotificationModel';
import { getNextListingNumber } from '../utils/getNextListingNumber';
import { sendNotificationEmail } from '../emailService';

const normalizeStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
    }

    return typeof value === 'string' && value.trim() !== '' ? [value] : [];
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

        const notifications = await NotificationModel.find({
            listingType: newListing.listingType,
            propertyType: newListing.propertyType,
            typeOfNovelty: newListing.typeOfNovelty,
            minPrice: { $lte: newListing.price },
            maxPrice: { $gte: newListing.price },
            minNumbersOfRoom: { $lte: newListing.numbersOfRooms },
            maxNumbersOfRoom: { $gte: newListing.numbersOfRooms },
            minTotalArea: { $lte: newListing.totalArea },
            maxTotalArea: { $gte: newListing.totalArea },
            minFloor: { $lte: newListing.numberOfFloor },
            maxFloor: { $gte: newListing.numberOfFloor },
        });

        const listingCoords = { lat: newListing.lat || 50, lon: newListing.lon || 36 };

        const matchedNotifications = notifications.filter((n) => {
            const distance = haversine(listingCoords, { lat: n.lat || 50, lon: n.lon || 36 });
            return distance <= n.locationRange * 1000;
        });

        for (const match of matchedNotifications) {
            const distance = Math.round(haversine(listingCoords, { lat: match.lat || 50, lon: match.lon || 36 }));
            await sendNotificationEmail({
                to: match.email,
                subject: 'Нове оголошення відповідає вашим параметрам пошуку',
                html: `<h2>З'явилося нове оголошення, що відповідає вашим перевагам:</h2>
                <p>Ціна: ${newListing.price}</p></br>
                <p>Тип оголошення: ${newListing.listingType}</p></br>
                <p>Кількість кімнат: ${newListing.numbersOfRooms}</p></br>
                <p>Загальна площа: ${newListing.totalArea} м²</p></br>
                <p>Поверх: ${newListing.numberOfFloor}</p></br>
                <p>Відстань до бажаної точки: ${distance} метрів</p></br>
                <p>Переглянути на сайті:</p>
                <b>${process.env.ALLOWED_ORIGINS}/details/${newListing.id}</b>
                <p>З повагою, команда Дім мрії App.</p>`,
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
