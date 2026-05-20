import { Server, Socket } from 'socket.io';
import { sendNotificationEmail } from '../emailService';
import ChatModel from '../models/ChatModel';
import User from '../models/UserModel';

const setupChatSocket = (io: Server) => {
    io.on('connection', (socket: Socket) => {

        socket.on('join_chat', (chatId: string) => {
            socket.join(chatId);
        });

        socket.on('send_message', async (data) => {
            const { chatId, text, senderId, senderName } = data;
            const newMessage = { senderId, senderName, text, timestamp: Date.now(), read: false };

            try {
                const chat = await ChatModel.findByIdAndUpdate(
                    chatId,
                    { $push: { messages: newMessage } },
                    { new: true }
                );

                if (!chat) {
                    console.log('[Socket] chat not found:', chatId);
                    return;
                }

                io.to(chatId).emit('new_message', newMessage);

                // Send email only on the first buyer message (notified flag gate)
                if (!chat.notified && senderId === chat.buyerId) {
                    const seller = await User.findById(chat.sellerId);

                    if (!seller?.email) {
                        console.error('[Email error] seller has no email', { sellerId: chat.sellerId, chatId });
                    } else {
                        try {
                            await sendNotificationEmail({
                                to: seller.email,
                                subject: `Нове повідомлення від ${senderName} — Дім мрії App`,
                                html: `
                                    <h1>Привіт, ${seller.name}!</h1>
                                    <p>Покупець <b>${senderName}</b> написав вам повідомлення щодо вашого оголошення.</p>
                                    <p><a href="${process.env.FRONTEND_URL}/chat/${chat.listingId}?chatId=${chatId}" style="
                                        display:inline-block;padding:10px 20px;
                                        background:#10b981;color:#fff;
                                        border-radius:8px;text-decoration:none;font-weight:bold;
                                    ">Відкрити чат</a></p>
                                `,
                            });
                            await ChatModel.findByIdAndUpdate(chatId, { notified: true });
                        } catch (emailErr) {
                            console.error('[Email error] sendNotificationEmail failed:', emailErr);
                        }
                    }
                }
            } catch (err) {
                console.error('[Socket send_message error]', err);
                socket.emit('chat_error', 'Failed to send message');
            }
        });

        socket.on('messages_read', async (chatId: string) => {
            await ChatModel.updateOne(
                { _id: chatId },
                {
                    $set: { 'messages.$[elem].read': true, notified: false },
                },
                { arrayFilters: [{ 'elem.read': false }] }
            );
            io.to(chatId).emit('messages_read', chatId);
        });
    });
};

export default setupChatSocket;
