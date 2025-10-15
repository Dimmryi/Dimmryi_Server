import dotenv from "dotenv";

const nodemailer = require('nodemailer');
dotenv.config();
const EMAIL_USER = process.env.EMAIL_USER;
const APP_PASSWORD = process.env.APP_PASSWORD;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: APP_PASSWORD,
    },
});

const sendNotificationEmail = async (to:any, subject:any, text:any) => {
    try {
        await transporter.sendMail({
            from: '"Real Estate App" <your_email@gmail.com>',
            to,
            subject,
            text,
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('Failed to send email:', error);
    }
};
export default sendNotificationEmail;
//module.exports = { sendNotificationEmail };
