import { Request, Response } from 'express';
import mongoose from 'mongoose';
import CommentModel from '../models/CommentModel';

export const handleDeleteCommentById = async (req: any, res: any) => {
    try {
        const { commentId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ message: `Invalid ID format: ${commentId}` });
        }

        const comment = await CommentModel.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        const isAdmin = req.session.user?.role === 'admin';
        const isOwner = req.session.user?.id === comment.authorId;
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        await comment.deleteOne();
        res.status(200).json({ message: 'Comment deleted.', deletedCount: 1 });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteCommentsByAuthorId = async (req: any, res: any) => {
    try {
        const { authorId } = req.params;
        const deleted = await CommentModel.deleteMany({ authorId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'No comments found for this author.' });
        }

        res.status(200).json({ message: 'Comments deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteCommentByListingId = async (req: any, res: any) => {
    try {
        const deleted = await CommentModel.deleteMany({ listingId: req.params.listingId });

        if (deleted.deletedCount === 0) {
            return res.status(404).json({ message: 'No comments found for this listing.' });
        }

        res.status(200).json({ message: 'Comments deleted.', deletedCount: deleted.deletedCount });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetCommentsByAuthorId = async (req: any, res: any) => {
    try {
        const comments = await CommentModel.find({ authorId: req.params.userId });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetCommentsByListingId = async (req: any, res: any) => {
    try {
        const comments = await CommentModel.find({ listingId: req.params.id });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetComments = async (req: Request, res: Response) => {
    try {
        const comments = await CommentModel.find();
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostComments = async (req: any, res: any) => {
    try {
        const { listingId, commentsAuthor, authorId, timePublication, comment, rating } = req.body;
        const newComment = new CommentModel({ listingId, commentsAuthor, authorId, timePublication, comment, rating });
        await newComment.save();
        res.status(201).json({ message: 'Comment saved successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleUpdateCommentById = async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const { comment, rating } = req.body;

        if (!comment) {
            return res.status(400).json({ error: 'Comment text is required.' });
        }

        const existingComment = await CommentModel.findById(id);
        const currentUserId = req.session.user?.id;

        if (req.session.user?.role !== 'admin' && currentUserId !== existingComment?.authorId) {
            return res.status(403).json({ message: 'Unauthorized.' });
        }

        const updated = await CommentModel.findByIdAndUpdate(
            id,
            { comment, rating: rating || '', timePublication: Date.now() },
            { new: true }
        );

        res.json(updated);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};
