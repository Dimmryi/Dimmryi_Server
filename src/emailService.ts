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
    const fromEmail = process.env.APP_EMAIL || process.env.EMAIL_USER || 'noreply@dimmryi.site';
    try {
        console.log('[Email debug] sendNotificationEmail', {
            from: fromEmail,
            to,
            subject,
        });

        const response: CreateEmailResponse = await resendClient.emails.send({
            from: fromEmail,
            to,
            subject,
            html,
        });

        console.log('[Email debug] resend response:', response);
        return response;
    } catch (error) {
        console.error('[Email error] sendNotificationEmail failed:', error);
        throw error;
    }
};

export const sendEmail = async (to:any, subject:any, text:any) => {
    const fromEmail = process.env.EMAIL_USER || 'no-reply@example.com';
    try {
        console.log('[Email debug] sendEmail', {
            from: fromEmail,
            to,
            subject,
        });

        await transporter.sendMail({
            from: `"Real Estate App" <${fromEmail}>`,
            to,
            subject,
            text,
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error('[Email error] sendEmail failed:', error);
        throw error;
    }
};
