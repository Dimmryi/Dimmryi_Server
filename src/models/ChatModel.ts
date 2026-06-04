import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    senderId:   { type: String, required: true },
    senderName: { type: String, required: true },
    text:       { type: String, required: true },
    timestamp:  { type: Number, default: () => Date.now() },
    read:       { type: Boolean, default: false },
});

const chatSchema = new mongoose.Schema({
    listingId:   { type: String, required: true },
    buyerId:     { type: String, required: true },
    buyerName:   { type: String, required: true },
    sellerId:    { type: String, required: true },
    sellerEmail: { type: String, required: false, default: '' },
    messages:    [messageSchema],
    notified:    { type: Boolean, default: false },
}, { timestamps: true });

// Унікальний чат для пари (покупець + оголошення)
chatSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });

//const MessageModel = mongoose.model("Message", messageSchema);
//module.exports = mongoose.model('Chat', chatSchema);
const ChatModel = mongoose.model("Chat", chatSchema);
export default ChatModel;
