import { Response, NextFunction } from 'express';
import User from '../models/UserModel';

const hasActiveSubscription = (user: any, allowedPlans: string[]) =>
    allowedPlans.includes(user.subscribeType) &&
    Boolean(user.subscribeExpired) &&
    new Date(user.subscribeExpired as Date).getTime() > Date.now();

export const requireAuth = (req: any, res: Response, next: NextFunction) => {
    if (!req.session?.user) return res.status(401).json({ message: 'Unauthorized' });
    next();
};

export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
    if (!req.session?.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.session.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    next();
};

export const requireOwnerOrAdmin = (resourceUserIdParam: string) => (req: any, res: Response, next: NextFunction) => {
    if (!req.session?.user) return res.status(401).json({ message: 'Unauthorized' });
    const isAdmin = req.session.user.role === 'admin';
    const isOwner = req.session.user.id === req.params[resourceUserIdParam];
    if (!isAdmin && !isOwner) return res.status(403).json({ message: 'Forbidden' });
    next();
};

export const requirePremiumOrAdmin = async (req: any, res: Response, next: NextFunction) => {
    if (!req.session?.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.session.user.role === 'admin') return next();

    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (!hasActiveSubscription(user, ['Premium'])) {
        return res.status(403).json({ message: 'Premium subscription required.' });
    }

    next();
};

export const requireStandardOrPremiumOrAdmin = async (req: any, res: Response, next: NextFunction) => {
    if (!req.session?.user) return res.status(401).json({ message: 'Unauthorized' });
    if (req.session.user.role === 'admin') return next();

    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    if (!hasActiveSubscription(user, ['Standard', 'Premium'])) {
        return res.status(403).json({ message: 'Standard or Premium subscription required.' });
    }

    req.subscriptionUser = user;
    next();
};

export const checkAuth = requireAuth;
