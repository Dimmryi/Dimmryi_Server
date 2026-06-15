import { Server, Socket } from 'socket.io';
import { sendNotificationEmail } from '../emailService';
import ChatModel from '../models/ChatModel';
import User from '../models/UserModel';

const getSocketUser = (socket: Socket) => (socket.request as any).session?.user;

const canAccessChat = (chat: any, user: any) =>
    Boolean(user?.id) &&
    (user.role === 'admin' || chat.buyerId === user.id || chat.sellerId === user.id);

const setupChatSocket = (io: Server) => {
    io.on('connection', (socket: Socket) => {

        socket.on('join_chat', async (chatId: string) => {
            const user = getSocketUser(socket);
            if (!user?.id) {
                socket.emit('chat_error', 'Unauthorized');
                return;
            }

            const chat = await ChatModel.findById(chatId);
            if (!chat || !canAccessChat(chat, user)) {
                socket.emit('chat_error', 'Forbidden');
                return;
            }

            socket.join(chatId);
        });

        socket.on('send_message', async (data) => {
            const { chatId, text } = data;
            const user = getSocketUser(socket);

            try {
                if (!user?.id) {
                    socket.emit('chat_error', 'Unauthorized');
                    return;
                }

                const chatBeforeUpdate = await ChatModel.findById(chatId);
                if (!chatBeforeUpdate || !canAccessChat(chatBeforeUpdate, user)) {
                    socket.emit('chat_error', 'Forbidden');
                    return;
                }

                const normalizedText = typeof text === 'string' ? text.trim() : '';
                if (!normalizedText) {
                    socket.emit('chat_error', 'Message text is required');
                    return;
                }

                const senderId = user.id;
                const senderName = user.name || 'User';
                const newMessage = { senderId, senderName, text: normalizedText, timestamp: Date.now(), read: false };

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
            const user = getSocketUser(socket);
            if (!user?.id) {
                socket.emit('chat_error', 'Unauthorized');
                return;
            }

            const chat = await ChatModel.findById(chatId);
            if (!chat || !canAccessChat(chat, user)) {
                socket.emit('chat_error', 'Forbidden');
                return;
            }

            await ChatModel.updateOne(
                { _id: chatId },
                {
                    $set: { 'messages.$[elem].read': true, notified: false },
                },
                { arrayFilters: [{ 'elem.read': false, 'elem.senderId': { $ne: user.id } }] }
            );
            io.to(chatId).emit('messages_read', chatId);
        });
    });
};

export default setupChatSocket;
