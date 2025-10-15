import Listing from '../models/ListingModel';
import mongoose from "mongoose";

export const handleDeleteLastListing = async (req:any, res:any) => {
    try {
        // Найти последний добавленный элемент
        const lastListing = await Listing.findOne().sort({ _id: -1 });

        if (!lastListing) {
            return res.status(404).json({ message: 'No listings found to delete.' });
        }

        // Удалить найденный элемент
        await Listing.findByIdAndDelete(lastListing._id);

        res.status(200).json({
            message: 'Successfully deleted the last listing.',
            deletedListing: lastListing,
        });
    } catch (error) {
        console.error('Error deleting the last listing:', error);
        res.status(500).json({ message: 'Failed to delete the last listing.' });
    }
};

export const handleDeleteListingByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;

        // Найти и удалить все списки, связанные с пользователем
        const deletedListings = await Listing.deleteMany({ ownerId: userId });

        if (deletedListings.deletedCount === 0) {
            return res.status(404).json({ message: 'No listings found for the user.' });
        }

        res.status(200).json({
            message: 'Successfully deleted listings for the user.',
            deletedCount: deletedListings.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting listings by user ID:', error);
        res.status(500).json({ message: 'Failed to delete listings by user ID.' });
    }
};

export const handleDeleteListingByUserName = async (req: any, res: any) => {
    try {
        const { userName } = req.params;

        //Найти и удалить все списки, связанные с пользователем
        const deletedListings = await Listing.deleteMany({ owner: userName });

        if (deletedListings.deletedCount === 0) {
            return res.status(404).json({ message: 'No listings found for the user.' });
        }

        res.status(200).json({
            message: 'Successfully deleted listings for the user.',
            deletedCount: deletedListings.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting listings by user ID:', error);
        res.status(500).json({ message: 'Failed to delete listings by user ID.' });
    }
};

export const handleDeleteListingById = async (req: any, res: any) => {
    try {
        const { id } = req.params;

        // Проверка на валидность ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: `Invalid ID format: ${id}` });
        }

        const objectId = new mongoose.Types.ObjectId(id);

        // Удаляем документ по _id
        const deletedListings = await Listing.deleteMany({ _id: objectId });

        if (deletedListings.deletedCount === 0) {
            return res.status(404).json({ message: 'No listings found by ID.' });
        }

        res.status(200).json({
            message: 'Successfully deleted listing by ID.',
            deletedCount: deletedListings.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting listings by ID:', error);
        res.status(500).json({ message: 'Failed to delete listings by ID.' });
    }
};

export const handleGetListingsById = async (req:any, res:any) => {
    try {
        //const listing = await Listing.findById(req.params.id);
        const listing = await Listing.find({ _id: req.params.id });
        if (!listing) {
            res.status(404).json({ message: 'Listing not found' });
            return
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingById = async (req:any, res:any) => {
    try {
        const listing = await Listing.findById(req.params.id);
        //const listing = await Listing.find({ _id: req.params.id });
        if (!listing) {
            res.status(404).json({ message: 'Listing not found' });
            return
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingsByOwnerId = async (req:any, res:any,) => {
    try {
        const listing = await Listing.find({ ownerId: req.params.userId });
        if (!listing) {
            res.status(404).json({ message: 'Listing not found' });
            return
        }
        res.json(listing);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListingsByUserName = async (req:any, res:any,) => {
    try {
        const listings = await Listing.find({ owner: req.params.userName });
        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetListings = async (req:any, res:any,) => {
    try {
        const listings = await Listing.find();
        res.json(listings);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostListings = async (req:any, res:any,) => {
    try {
        const { image, ...rest } = req.body;
            const listing = new Listing({
                image: Array.isArray(image) ? image : [image], // Поддержка массива
                ...rest
            });
            await listing.save();
            res.json({ message: 'Listing added with multiple images!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateListingById  = async (req:any, res:any,) => {
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

        //Проверяем права доступа (владелец объявления должен совпадать с текущим пользователем)
        if (existingListing.owner !== currentUserName && currentUserRole !== 'admin' && existingListing.ownerId !== currentUserId) {
            return res.status(403).json({message: `Unauthorized access. You must be the owner (${existingListing.owner}) or an admin to edit this listing.`});
        }

        const allowedUpdates = {
            apartmentDetails: updatedData.apartmentDetails,
            description: updatedData.description,
            contact: updatedData.contact,
            price: updatedData.price,
            location: updatedData.location,
            image: updatedData.image,
            propertyType: updatedData.propertyType,
            date: Date.now()
        };

        // Выполняем обновление
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