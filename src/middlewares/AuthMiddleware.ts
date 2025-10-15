import { Request, Response, NextFunction } from "express";
import User from "../models/UserModel";

export const isAdmin = (req: any, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "Access denied. Admins only." });
    }
};

export const requireAuth = async (req: any, res: Response, next: NextFunction) => {
    const userId = req.session?.user?.id;

    if (!userId) {
        return res.status(401).json({ message: 'Вы не авторизованы' });
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            req.session.destroy(() => {});
            return res.status(401).json({ message: 'Сессия недействительна. Пользователь не найден.' });
        }

        req.user = user; // для удобного доступа в других обработчиках
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(500).json({ message: 'Ошибка авторизации' });
    }
};

export const checkAuth = async (req: any, res: any, next: NextFunction) => {
    if (!req.session.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }
    next();
};