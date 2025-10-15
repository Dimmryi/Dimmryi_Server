import 'express-session';

declare module 'express-session' {
    interface SessionData {
        user?: {
            id: string;
            name: string;
            email: string;
            preferredContact: string;
            contact: string;
        };
    }
}

declare module 'express-request' {
    interface Request {
        session: session.Session & Partial<session.SessionData>;
    }
}