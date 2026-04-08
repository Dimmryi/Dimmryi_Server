import dotenv from "dotenv";
import {CreateEmailResponse, Resend} from 'resend';
dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

const sendNotificationEmail  = async ({ to, subject, html }:{to:any,subject:any,html:any}) => {
    try {
        const response: CreateEmailResponse = await resend.emails.send({
            from: `"My Dream House App" <${process.env.APP_EMAIL}>` || `onboarding@resend.dev`,
            to,
            subject,
            html,
        });

        return response;
    } catch (error) {
        console.error('Email error:', error);
        throw error;
    }
};

export default sendNotificationEmail;
//****************************************************************************************
// import dotenv from "dotenv";
//
// const nodemailer = require('nodemailer');
// dotenv.config();
// const EMAIL_USER = process.env.EMAIL_USER;
// const APP_PASSWORD = process.env.APP_PASSWORD;
//
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: EMAIL_USER,
//         pass: APP_PASSWORD,
//     },
// });
//
// const sendNotificationEmail = async (to:any, subject:any, text:any) => {
//     try {
//         await transporter.sendMail({
//             from: '"Real Estate App" <your_email@gmail.com>',
//             to,
//             subject,
//             text,
//         });
//         console.log(`Email sent to ${to}`);
//     } catch (error) {
//         console.error('Failed to send email:', error);
//     }
// };
// export default sendNotificationEmail;
// //module.exports = { sendNotificationEmail };
//***********************************************************
// //import nodemailer from 'nodemailer';
// const nodemailer = require('nodemailer');
// import dotenv from 'dotenv';
// dotenv.config();
//
// const transporter = nodemailer.createTransport({
//     host: 'smtp.gmail.com',
//     port: 465,           // 465 для SSL (надёжнее), или 587 для TLS
//     secure: true,        // true для порта 465
//     auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.APP_PASSWORD, // 16 символов БЕЗ пробелов
//     },
// });
//
// // Диагностика при старте — убери после проверки
// transporter.verify((error:any) => {
//     if (error) {
//         console.error('❌ Nodemailer error:', error.message);
//     } else {
//         console.log('✅ Nodemailer: Gmail SMTP ready');
//     }
// });
//
// const sendNotificationEmail = async (
//     to: string,
//     subject: string,
//     text: string
// ): Promise<void> => {
//     try {
//         await transporter.sendMail({
//             from: `"Real Estate App" <${process.env.EMAIL_USER}>`,
//             to,
//             subject,
//             text,
//         });
//         console.log(`✅ Email sent to ${to}`);
//     } catch (error: any) {
//         // Логируем детальную ошибку — видно в Render Logs
//         console.error(`❌ Failed to send email to ${to}:`, error.message);
//         throw error; // пробрасываем чтобы вызывающий код знал об ошибке
//     }
// };
//
// export default sendNotificationEmail;
//*************************************************************************88