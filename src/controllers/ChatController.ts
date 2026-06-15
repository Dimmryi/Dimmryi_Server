import { Request, Response } from 'express';
import ChatModel from '../models/ChatModel';
import ListingModel from '../models/ListingModel';

const getSessionUser = (req: any) => req.session?.user;

const canAccessChat = (chat: any, user: any) =>
    Boolean(user?.id) &&
    (user.role === 'admin' || chat.buyerId === user.id || chat.sellerId === user.id);

export const handleInitChat = async (req: Request, res: Response) => {
    const { listingId } = req.body;
    const user = getSessionUser(req);

    if (!listingId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const listing = await ListingModel.findById(listingId).select('ownerId').lean();
        if (!listing) return res.status(404).json({ error: 'Listing not found' });

        const sellerId = String((listing as any).ownerId || '');
        if (!sellerId) return res.status(400).json({ error: 'Listing owner is missing' });
        if (sellerId === user.id) return res.status(400).json({ error: 'Owner cannot create a buyer chat for own listing' });

        const chat = await ChatModel.findOneAndUpdate(
            { listingId, buyerId: user.id },
            { $setOnInsert: { listingId, buyerId: user.id, buyerName: user.name, sellerId, messages: [] } },
            { new: true, upsert: true }
        );
        res.json(chat);
    } catch (err) {
        res.status(500).json({ error: 'Failed to init chat' });
    }
};

export const handleGetChat = async (req: Request, res: Response) => {
    try {
        const user = getSessionUser(req);
        const chat = await ChatModel.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        if (!canAccessChat(chat, user)) return res.status(403).json({ error: 'Forbidden' });
        res.json(chat);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load chat' });
    }
};

export const handleGetChatsByListing = async (req: Request, res: Response) => {
    try {
        const user = getSessionUser(req);
        const listing = await ListingModel.findById(req.params.listingId).select('ownerId').lean();
        if (!listing) return res.status(404).json({ error: 'Listing not found' });

        if (user.role !== 'admin' && String((listing as any).ownerId || '') !== user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const chats = await ChatModel.find(
            { listingId: req.params.listingId },
            { messages: { $slice: -1 }, buyerName: 1, buyerId: 1, updatedAt: 1 }
        ).sort({ updatedAt: -1 });
        res.json(chats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load chats' });
    }
};

export const handleMarkRead = async (req: Request, res: Response) => {
    try {
        const user = getSessionUser(req);
        const chat = await ChatModel.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        if (!canAccessChat(chat, user)) return res.status(403).json({ error: 'Forbidden' });

        await ChatModel.updateOne(
            { _id: req.params.chatId },
            { $set: { 'messages.$[elem].read': true } },
            { arrayFilters: [{ 'elem.read': false, 'elem.senderId': { $ne: user.id } }] }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};
