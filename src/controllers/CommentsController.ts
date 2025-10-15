import mongoose from "mongoose";
import CommentModel from "../models/CommentModel";

export const handleDeleteCommentById = async (req:any, res:any) => {
    try {
        const { commentId } = req.params;
        // Проверка на валидность ObjectId
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ message: `Invalid ID format: ${commentId}` });
        }

        const objectId = new mongoose.Types.ObjectId(commentId);

        //Найти и удалить все списки, связанные с пользователем
        const deletedComment = await CommentModel.deleteMany({ _id: objectId });

        if (deletedComment.deletedCount === 0) {
            return res.status(404).json({ message: 'No Comment data found.' });
        }

        res.status(200).json({
            message: `Successfully deleted comment.`,
            deletedCount: deletedComment.deletedCount,
        });

    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteCommentsByAuthorId = async (req:any, res:any) => {
    try {
        const { authorId } = req.params;

        // if (req.session.user?.id !== authorId && req.session.user?.role !== 'admin') {
        //     return res.status(403).json({ error: 'Forbidden' });
        // }

        const deletedComments = await CommentModel.deleteMany({ authorId: authorId });
        if (deletedComments.deletedCount === 0) {
            return res.status(404).json({ message: 'No Comment data found.' });
        }

        res.status(200).json({
            message: `Successfully deleted comment.`,
            deletedCount: deletedComments.deletedCount,
        });

    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleDeleteCommentByListingId = async (req:any, res:any) => {
    try {
        //Найти и удалить все списки, связанные с пользователем
        const deletedComment = await CommentModel.deleteMany({ listingId: req.params.listingId });

        if (deletedComment.deletedCount === 0) {
            return res.status(404).json({ message: 'No Comment data found.' });
        }

        res.status(200).json({
            message: `Successfully deleted comment.`,
            deletedCount: deletedComment.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetCommentsByAuthorId = async (req:any, res:any) => {
    try {
        const comment = await CommentModel.find({ authorId: req.params.userId });
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return
        }
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetCommentsByListingId = async (req:any, res:any) => {
    try {
        const comment = await CommentModel.find({ listingId: req.params.id });
        if (!comment) {
            res.status(404).json({ message: 'Comment not found' });
            return
        }
        res.json(comment);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handleGetComments = async (req:any, res:any) => {
    try{
        const comments = await CommentModel.find();
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};

export const handlePostComments = async (req:any, res:any) => {
    try {
        const {listingId, commentsAuthor, authorId, timePublication, comment, rating} = req.body;
        const newComment = new CommentModel({
            listingId,
            commentsAuthor,
            authorId,
            timePublication,
            comment,
            rating,
        });
        await newComment.save();

        res.status(201).json({ message: `Comment saved successfully!`});
    }catch (error) {
        res.status(500).json({ error: 'Error saved comment.' });
    }
};

export const handleUpdateCommentById = async (req:any, res:any) => {
    try {
        const { id } = req.params;
        const { comment, rating, authorId } = req.body;

        if (!comment) {
            return res.status(400).json({ error: "Comment and rating are required" });
        }

        const existingComment = await CommentModel.findById(id);
        const currentUserId = req.session.user?.id;

        if (req.session.user?.role !== 'admin' && currentUserId !== existingComment?.authorId) {
            return res.status(403).json({ message: `Unauthorized : ${req.session.user?.role}` });
        }

        const updatedComment = await CommentModel.findByIdAndUpdate(
            id,
            { comment, rating: rating || "", timePublication: Date.now() },
            { new: true }
        );

        res.json(updatedComment);
    } catch (error:any) {
        res.status(500).json({ error: error.message });
    }
};