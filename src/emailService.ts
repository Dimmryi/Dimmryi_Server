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

        const response: any = await resendClient.emails.send({
            from: fromEmail,
            to,
            subject,
            html,
        });

        console.log('[Email debug] resend response:', response);

        // Resend may return an object with `error` instead of throwing.
        if (response && response.error) {
            const err = response.error;
            console.error('[Email error] Resend returned error object:', err);

            // If domain is not verified in Resend, fallback to SMTP (nodemailer)
            if (err.name === 'validation_error' && /domain/i.test(err.message || '')) {
                console.log('[Email debug] Falling back to SMTP because Resend domain not verified');
                try {
                    const mailOptions = {
                        from: `${process.env.APP_EMAIL || process.env.EMAIL_USER}`,
                        to,
                        subject,
                        html,
                    };
                    const smtpResult = await transporter.sendMail(mailOptions);
                    console.log('[Email debug] SMTP fallback result:', smtpResult);
                    return { provider: 'smtp', result: smtpResult };
                } catch (smtpErr) {
                    console.error('[Email error] SMTP fallback failed:', smtpErr);
                    throw smtpErr;
                }
            }

            // For other resend errors, throw to let caller handle it
            const e = new Error(err.message || 'Resend error');
            // attach original for debugging
            (e as any).original = err;
            throw e;
        }

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
