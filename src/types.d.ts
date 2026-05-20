import 'express-session';

declare module 'express-session' {
    interface SessionData {
        user?: {
            id: string;
            name: string;
            email: string;
            preferredContact?: string;
            contact?: string;
            role?: string;
            authMethod?: string;
        };
    }
}
