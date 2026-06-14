const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://dimmrii.netlify.app',
];

export const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, '');

export const getAllowedOrigins = () => {
    const envOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',').map(normalizeOrigin)
        : [];

    return Array.from(new Set([...envOrigins, ...DEFAULT_ALLOWED_ORIGINS].map(normalizeOrigin).filter(Boolean)));
};

export const isAllowedOrigin = (origin: string | undefined, allowedOrigins = getAllowedOrigins()) =>
    !origin || allowedOrigins.includes(normalizeOrigin(origin));
