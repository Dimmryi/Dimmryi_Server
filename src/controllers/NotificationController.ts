import mongoose from 'mongoose';
import { Request, Response } from 'express';
import NotificationModel from '../models/NotificationModel';

export const handleGetNotifications = async (req: Request, res: Response) => {
    try {
        const notifications = await NotificationModel.find();
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetNotificationById = async (req: any, res: any) => {
    try {
        const { notificationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ message: `Invalid ID format: ${notificationId}` });
        }
        const notification = await NotificationModel.findById(new mongoose.Types.ObjectId(notificationId));
        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetNotificationsByUserId = async (req: Request, res: Response) => {
    try {
        const notification = await NotificationModel.find({ userId: req.params.userId });
        if (!notification) {
            res.status(404).json({ message: 'Notification not found' });
            return;
        }
        res.json(notification);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostNotification = async (req: any, res: Response) => {
    try {
        const {
            listingType, propertyType, typeOfNovelty,
            minNumbersOfRoom, maxNumbersOfRoom,
            minTotalArea, maxTotalArea,
            minFloor, maxFloor,
            minPrice, maxPrice,
            locationSought, locationRange,
            email, userId, lat, lon,
        } = req.body;

        const currentUserId = req.session.user?.id;
        const currentEmail = req.session.user?.email;

        const newNotification = new NotificationModel({
            listingType, propertyType, typeOfNovelty,
            minNumbersOfRoom, maxNumbersOfRoom,
            minTotalArea, maxTotalArea,
            minFloor, maxFloor,
            minPrice, maxPrice,
            locationSought, locationRange,
            lat, lon,
            userId: userId || currentUserId,
            email: email || currentEmail,
            date: Date.now(),
        });
        await newNotification.save();

        res.status(201).json({ message: 'Notification saved successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateNotification = async (req: any, res: any) => {
    try {
        const { notificationId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ message: `Invalid ID format: ${notificationId}` });
        }

        const objectId = new mongoose.Types.ObjectId(notificationId);
        const existingNotification = await NotificationModel.findById(objectId);

        if (!existingNotification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const currentUserId = req.session.user?.id;
        const currentUserRole = req.session.user?.role;

        if (existingNotification.userId !== currentUserId && currentUserRole !== 'admin') {
            return res.status(403).json({ message: 'Unauthorized access. You must be the owner or an admin.' });
        }

        const updatedData = req.body;
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
            locationSought: updatedData.locationSought,
            locationRange: updatedData.locationRange,
            lat: updatedData.lat,
            lon: updatedData.lon,
            email: updatedData.email,
            date: Date.now(),
        };

        const updated = await NotificationModel.findByIdAndUpdate(
            objectId,
            { $set: allowedUpdates },
            { new: true, runValidators: true }
        );

        res.json(updated);
    } catch (error) {
        console.error('Error updating notification:', error);
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteNotification = async (req: any, res: any) => {
    try {
        const { notificationId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ message: `Invalid ID format: ${notificationId}` });
        }

        const objectId = new mongoose.Types.ObjectId(notificationId);
        const deleted = await NotificationModel.deleteMany({ _id: objectId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.status(200).json({ message: 'Notification deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
