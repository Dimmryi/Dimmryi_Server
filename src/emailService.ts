import dotenv from "dotenv";
import {CreateEmailResponse, Resend} from 'resend';
dotenv.config();
const nodemailer = require('nodemailer');

// Export dependencies for testing purposes
export let resendClient = new Resend(process.env.RESEND_API_KEY);

export let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.APP_PASSWORD,
    },
});

export const sendNotificationEmail  = async ({ to, subject, html }:{to:any,subject:any,html:any}) => {
    try {
        const response: CreateEmailResponse = await resendClient.emails.send({
            from: `noreply@dimmryi.site`,
            //`"My Dream House App" <${process.env.APP_EMAIL}>` || `onboarding@resend.dev`
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

export const sendEmail = async (to:any, subject:any, text:any) => {
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
