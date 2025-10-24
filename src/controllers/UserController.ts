import User from "../models/UserModel";
import mongoose from "mongoose";
import ListingModel from "../models/ListingModel";
import CommentModel from "../models/CommentModel";
import bcrypt from "bcryptjs";

export const handleDeleteUserByUserName = async (req: any, res: any) => {
    try {
        const { userName } = req.params;

        //Найти и удалить все списки, связанные с пользователем
        const deletedUser = await User.deleteMany({ name: userName });

        if (deletedUser.deletedCount === 0) {
            return res.status(404).json({ message: 'No User data found.' });
        }

        res.status(200).json({
            message: `Successfully deleted user's data.`,
            deletedCount: deletedUser.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting User by userName:', error);
        res.status(500).json({ message: 'Failed to delete User by userName.' });
    }
};

export const handleDeleteUserAndAllByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: `Invalid ID format: ${userId}` });
        }
        const objectId = new mongoose.Types.ObjectId(userId);
        // Каскадное удаление
        await ListingModel.deleteMany({ ownerId: objectId });  // userId
        await CommentModel.deleteMany({ authorId: objectId });
        const deletedUser = await User.deleteMany({ _id: objectId });

        if (deletedUser.deletedCount === 0) {
            return res.status(404).json({ message: 'No User data found.' });
        }

        res.status(200).json({ message: 'User and all data deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Deletion failed' });
    }
};

export const handleDeleteUserByUserId = async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        // Проверка на валидность ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: `Invalid ID format: ${userId}` });
        }

        const objectId = new mongoose.Types.ObjectId(userId);

        //Найти и удалить все списки, связанные с пользователем
        const deletedUser = await User.deleteMany({ _id: objectId });

        if (deletedUser.deletedCount === 0) {
            return res.status(404).json({ message: 'No User data found.' });
        }

        res.status(200).json({
            message: `Successfully deleted user's data.`,
            deletedCount: deletedUser.deletedCount,
        });
    } catch (error) {
        console.error('Error deleting User by userName:', error);
        res.status(500).json({ message: 'Failed to delete User by userName.' });
    }
};

// export const handlePostUsersToBase = async (req: any, res: any) => {
//     try {
//         const { name, email, password} = req.body;
//         const hashedPassword = await bcrypt.hash(password, 10);
//
//         const newUser = new User({
//             name,
//             email,
//             password,
//         });
//
//         await newUser.save();
//         req.session.user = {   // Сохраняем данные в сессию
//             id: `${newUser._id}`,
//             name: newUser.name,
//             email: newUser.email,
//             role: newUser.role,
//         };
//         await req.session.save(); // Явное сохранение
//         res.status(201).json({ message: `User registered successfully!`, user: req.session.user });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Error registering user.' });
//     }
// };

export const handlePostUsersToBase = async (req: any, res: any) => {
    try {
        const { name, email, password } = req.body;

        // 1. Проверяем существование пользователя
        const existingUser:any = await User.findOne({ email });

        // 2. Обработка существующего пользователя
        if (existingUser) {
            // 2.1 Пользователь зарегистрирован через Google
            if (existingUser.authMethod === 'google') {
                return res.status(409).json({
                    message: 'User registered with Google',
                    authMethod: 'google'
                });
            }

            // 2.2 Пользователь зарегистрирован обычным способом
            const passwordMatch = await bcrypt.compare(password, existingUser.password);

            return res.status(409).json({
                message: 'User already exists',
                authMethod: 'password',
                passwordMatch
            });
        }

        // 3. Создание нового пользователя
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email,
            //password: hashedPassword,
            password,
            authMethod: 'password' // Указываем метод регистрации
        });

        await newUser.save();

        // 4. Создание сессии
        req.session.user = {
            id: newUser._id.toString(),
            name: newUser.name,
            email: newUser.email,
            role: newUser.role || 'user',
            authMethod: 'password'
        };

        await req.session.save();

        // 5. Успешный ответ
        res.status(201).json({
            message: 'User registered successfully!',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                authMethod: 'password'
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering user.' });
    }
};

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

        //Проверяем права доступа (владелец объявления должен совпадать с текущим пользователем)
        if (existingListing.owner !== currentUserName && currentUserRole !== 'admin' && existingListing.ownerId !== currentUserId) {
            return res.status(403).json({message: `Unauthorized access. You must be the owner (${existingListing.owner}) or an admin to edit this listing.`});
        }
        // Обновляем только разрешенные поля
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
