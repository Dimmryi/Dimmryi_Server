import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
    listingId: { type: String, required: true },
    commentsAuthor: { type: String, required: true },
    authorId: { type: String, required: true },
    timePublication: { type: String, required: true },
    comment: { type: String, required: false },
    rating: { type: String,  default: ""},
});

const CommentModel = mongoose.model('Comment', commentSchema);
export default CommentModel;