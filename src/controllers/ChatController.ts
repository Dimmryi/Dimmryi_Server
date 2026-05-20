import { Request, Response } from 'express';
import ChatModel from '../models/ChatModel';

export const handleInitChat = async (req: Request, res: Response) => {
    const { listingId, buyerId, buyerName, sellerId } = req.body;

    if (!listingId || !buyerId || !buyerName || !sellerId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const chat = await ChatModel.findOneAndUpdate(
            { listingId, buyerId },
            { $setOnInsert: { listingId, buyerId, buyerName, sellerId, messages: [] } },
            { new: true, upsert: true }
        );
        res.json(chat);
    } catch (err) {
        res.status(500).json({ error: 'Failed to init chat' });
    }
};

export const handleGetChat = async (req: Request, res: Response) => {
    try {
        const chat = await ChatModel.findById(req.params.chatId);
        if (!chat) return res.status(404).json({ error: 'Chat not found' });
        res.json(chat);
    } catch (err) {
        res.status(500).json({ error: 'Failed to load chat' });
    }
};

export const handleGetChatsByListing = async (req: Request, res: Response) => {
    try {
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
        await ChatModel.updateOne(
            { _id: req.params.chatId },
            { $set: { 'messages.$[elem].read': true } },
            { arrayFilters: [{ 'elem.read': false }] }
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};
