import express from 'express';
import {handleDeleteCommentById,
    handleDeleteCommentsByAuthorId,
    handleDeleteCommentByListingId,
    handleGetCommentsByAuthorId,
    handleGetCommentsByListingId,
    handleGetComments,
    handlePostComments,
    handleUpdateCommentById,
} from '../controllers/CommentsController';
import {checkAuth} from '../middlewares/AuthMiddleware';

const router = express.Router();
router.delete('/api/comments/:commentId', handleDeleteCommentById);
router.delete('/api/comments/author/:authorId', handleDeleteCommentsByAuthorId);
router.delete('/api/comments/listingId/:listingId', handleDeleteCommentByListingId);
router.get('/api/comments/authorId/:userId', handleGetCommentsByAuthorId);
router.get('/api/comments/listingId/:id', handleGetCommentsByListingId);
router.get('/comments', handleGetComments);
router.post('/api/comments', handlePostComments);
router.put('/api/comments/:id',checkAuth, handleUpdateCommentById);

export default router;