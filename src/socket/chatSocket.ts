import { Server, Socket } from 'socket.io';
import { sendNotificationEmail } from '../emailService';
import ChatModel from '../models/ChatModel';
import User from '../models/UserModel';

const setupChatSocket = (io: Server) => {
    io.on('connection', (socket: Socket) => {

        socket.on('join_chat', (chatId: string) => {
            socket.join(chatId);
        });

        socket.on('send_message', async (data: {
            chatId: string;
            text: string;
            senderId: string;
            senderName: string;
        }) => {
            const { chatId, text, senderId, senderName } = data;

            const newMessage = {
                senderId,
                senderName,
                text,
                timestamp: Date.now(),
                read: false,
            };

            try {
                const chat = await ChatModel.findByIdAndUpdate(
                    chatId,
                    { $push: { messages: newMessage } },
                    { new: true }
                );
                if (!chat) return;

                io.to(chatId).emit('new_message', newMessage);

                if (!chat.notified && senderId === chat.buyerId) {
                    await ChatModel.findByIdAndUpdate(chatId, { notified: true });

                    const seller = await User.findById(chat.sellerId);
                    if (seller?.email) {
                        const chatUrl = `${process.env.FRONTEND_URL}/chat/${chat.listingId}?chatId=${chatId}`;
                        await sendNotificationEmail({
                            to: seller.email,
                            subject: `Нове повідомлення від ${senderName} — Дім мрії App`,
                            html: `
                                <h1>Привіт, ${seller.name}!</h1>
                                <p>Покупець <b>${senderName}</b> написав вам повідомлення щодо вашого оголошення.</p>
                                <p><a href="${chatUrl}" style="
                                    display:inline-block;padding:10px 20px;
                                    background:#10b981;color:#fff;
                                    border-radius:8px;text-decoration:none;font-weight:bold;
                                ">Відкрити чат</a></p>
                                <p style="color:#9ca3af;font-size:12px">${chatUrl}</p>
                            `,
                        });
                    }
                }
            } catch (err) {
                socket.emit('chat_error', 'Failed to send message');
            }
        });

        socket.on('messages_read', async (chatId: string) => {
            await ChatModel.updateOne(
                { _id: chatId },
                {
                    $set: {
                        'messages.$[elem].read': true,
                        notified: false,
                    },
                },
                { arrayFilters: [{ 'elem.read': false }] }
            );
            io.to(chatId).emit('messages_read', chatId);
        });
    });
};

export default setupChatSocket;
