import dotenv from 'dotenv';
import { Resend } from 'resend';
dotenv.config();

export const resendClient = new Resend(process.env.RESEND_API_KEY);

export const sendNotificationEmail = async ({ to, subject, html }: { to: any; subject: any; html: any }) => {
    // Must use verified Resend domain — Resend rejects unverified sender domains
    const fromEmail = `noreply@${process.env.RESEND_DOMAIN || 'dimmryi.site'}`;
    try {
        console.log('[Email debug] sendNotificationEmail', { from: fromEmail, to, subject });

        const response: any = await resendClient.emails.send({ from: fromEmail, to, subject, html });

        console.log('[Email debug] resend response:', response);

        if (response && response.error) {
            const err = response.error;
            console.error('[Email error] Resend returned error object:', err);
            const e = new Error(err.message || 'Resend error');
            (e as any).original = err;
            throw e;
        }

        return response;
    } catch (error) {
        console.error('[Email error] sendNotificationEmail failed:', error);
        throw error;
    }
};

export const sendEmail = async (to: any, subject: any, text: any) => {
    const fromEmail = `noreply@${process.env.RESEND_DOMAIN || 'dimmryi.site'}`;
    try {
        console.log('[Email debug] sendEmail', { from: fromEmail, to, subject });

        const response: any = await resendClient.emails.send({
            from: `"Real Estate App" <${fromEmail}>`,
            to,
            subject,
            html: `<p>${text}</p>`,
        });

        if (response && response.error) {
            console.error('[Email error] Resend returned error object:', response.error);
            throw new Error(response.error.message || 'Resend error');
        }

        console.log(`[Email debug] Email sent to ${to}`);
    } catch (error) {
        console.error('[Email error] sendEmail failed:', error);
        throw error;
    }
};
