import { Response, NextFunction } from 'express';

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

export const checkAuth = requireAuth;
