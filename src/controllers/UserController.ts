import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/UserModel';
import ListingModel from '../models/ListingModel';
import CommentModel from '../models/CommentModel';

export const handleDeleteUserByUserName = async (req: any, res: any) => {
    try {
        const { userName } = req.params;
        const deleted = await User.deleteMany({ name: userName });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        console.error('Error deleting user by username:', error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};

export const handleDeleteUserByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: `Invalid ID format: ${userId}` });
        }

        const deleted = await User.deleteMany({ _id: new mongoose.Types.ObjectId(userId) });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        console.error('Error deleting user by ID:', error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};

export const handleDeleteUserAndAllByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: `Invalid ID format: ${userId}` });
        }
        const objectId = new mongoose.Types.ObjectId(userId);

        await ListingModel.deleteMany({ ownerId: objectId });
        await CommentModel.deleteMany({ authorId: objectId });
        const deleted = await User.deleteMany({ _id: objectId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json({ message: 'User and all associated data deleted.' });
    } catch (error) {
        res.status(500).json({ error: 'Deletion failed.' });
    }
};

export const handlePostUsersToBase = async (req: any, res: any) => {
    try {
        const { name, email, password } = req.body;
        const existingUser: any = await User.findOne({ email });

        if (existingUser) {
            if (existingUser.authMethod === 'google') {
                return res.status(409).json({ message: 'User registered with Google', authMethod: 'google' });
            }

            const passwordMatch = await bcrypt.compare(password, existingUser.password);
            return res.status(409).json({ message: 'User already exists', authMethod: 'password', passwordMatch });
        }

        const newUser = new User({ name, email, password, authMethod: 'password' });
        await newUser.save();

        req.session.user = {
            id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role || 'user',
            authMethod: 'password',
        };
        await req.session.save();

        res.status(201).json({
            message: 'User registered successfully!',
            user: { id: newUser._id, name: newUser.name, email: newUser.email, authMethod: 'password' },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering user.' });
    }
};

// Handles listing update via the /api/listings/:id route mounted in UserRoutes
export const handlePostedAndEditUser = async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const existingListing = await ListingModel.findById(id);

        if (!existingListing) {
            return res.status(404).json({ message: 'Listing not found' });
        }

        const currentUserId = req.session.user?.id;
        const currentUserName = req.session.user?.name;
        const currentUserRole = req.session.user?.role;

        if (existingListing.owner !== currentUserName && currentUserRole !== 'admin' && existingListing.ownerId !== currentUserId) {
            return res.status(403).json({ message: `Unauthorized. You must be the owner or an admin.` });
        }

        const allowedUpdates = {
            apartmentDetails: updatedData.apartmentDetails,
            description: updatedData.description,
            contact: updatedData.contact,
            price: updatedData.price,
            location: updatedData.location,
            image: updatedData.image,
            propertyType: updatedData.propertyType,
            date: Date.now(),
        };

        const updatedListing = await ListingModel.findByIdAndUpdate(
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
