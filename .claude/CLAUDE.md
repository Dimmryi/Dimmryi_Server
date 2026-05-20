# Node.js Real Estate Project - Render Deployment Guide

**АКТУАЛЬНА КОНФІГ ПРОЄКТУ (Real Estate App на PORT 5000)**

---

## 1. Залежності та Версії

### 1.1 Node.js Version
```json
{
  "engines": {
    "node": "20.x"
  }
}
```

### 1.2 Поточні Залежності
- `express` 4.21.2 — веб-фреймворк
- `mongoose` 8.9.5 — MongoDB ORM
- `socket.io` 4.8.3 — real-time WebSocket
- `cloudinary` 2.6.1 — хостинг зображень
- `connect-mongo` 5.1.0 — сесії в MongoDB
- `jsonwebtoken` 9.0.2 — JWT auth
- `google-auth-library` 10.1.0 — Google OAuth
- `nodemailer` 7.0.5 — Gmail SMTP
- `resend` 6.10.0 — Email API
- `bcryptjs` 3.0.2 — password hashing

---

## 2. Build & Start Scripts

### 2.1 Package.json Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "start": "node dist/index.js",
    "build": "tsc"
  }
}
```

### 2.2 Render Configuration
**Встанови на Render Dashboard:**
- **Build Command**: `pnpm install && pnpm build`
- **Start Command**: `pnpm start`
- **Node Version**: 20.x
- **Region**: Oregon

---

## 3. Environment Variables (Render Dashboard)

### ⚠️ ВАЖНО: Встановити ці змінні на Render Secret Environment

```
NODE_ENV=production
PORT=5000
MONGO_DB=mongodb+srv://username:password@cluster.mongodb.net/dbname?authSource=admin&maxPoolSize=10
JWT_SECRET=твоя_криптографічна_строка_мін_32_символи
COOKIE_SECRET=твоя_cookie_secret_key
GOOGLE_CLIENT_ID=твій_google_oauth_client_id
RESEND_API_KEY=твій_resend_api_key
EMAIL_USER=dimmryi@gmail.com
APP_PASSWORD=твій_google_app_password_16_символів
CLOUDINARY_CLOUD_NAME=dm2gavkzs
CLOUDINARY_API_KEY=196748952826622
CLOUDINARY_API_SECRET=твій_cloudinary_secret
ALLOWED_ORIGINS=https://dimmryi.netlify.app
FRONTEND_URL=https://dimmryi.netlify.app
```

---

## 4. Server Architecture (PORT 5000)

### 4.1 Актуальна Конфіг
```typescript
// src/index.ts
const port = Number(process.env.PORT) || 5000;

// Залежності
import { createServer } from 'http';
import { Server } from 'socket.io';

// HTTP + WebSocket Server
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
    credentials: true,
  },
});

setupChatSocket(io);

// ВАЖНО: Використовуй httpServer.listen(), НЕ app.listen()
httpServer.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
```

### 4.2 Graceful Shutdown
```typescript
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  httpServer.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## 5. MongoDB Atlas (MONGO_DB)

### 5.1 Connection String
```
mongodb+srv://admin:password@cluster.mongodb.net/dbname?authSource=admin&maxPoolSize=10&minPoolSize=5&retryWrites=true&w=majority
```

### 5.2 Express Session Storage
Проєкт використовує `connect-mongo` для зберігання сесій в MongoDB:

```typescript
import MongoStore from 'connect-mongo';

app.use(session({
  secret: process.env.COOKIE_SECRET,
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({ mongoUrl: process.env.MONGO_DB }),
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

---

## 6. Аутентифікація

### 6.1 Google OAuth
```typescript
import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleToken(token: string) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    return ticket.getPayload();
}
```

### 6.2 JWT Authentication
```typescript
export const authenticateJWT = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
};
```

---

## 7. Email Service

### 7.1 Resend API
```typescript
import { Resend } from 'resend';

export let resendClient = new Resend(process.env.RESEND_API_KEY);

export const sendNotificationEmail = async ({ to, subject, html }) => {
    const response = await resendClient.emails.send({
        from: `noreply@dimmryi.site`,
        to,
        subject,
        html,
    });
    return response;
};
```

### 7.2 Gmail SMTP (Nodemailer)
```typescript
export let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.APP_PASSWORD,
    },
});
```

**ВАЖНО:** APP_PASSWORD — це НЕ звичайний пароль, а спеціальний токен з Google!
- Включи 2FA у Google Account
- Перейди https://myaccount.google.com/apppasswords
- Скопіюй 16-значний пароль

---

## 8. Cloudinary (Media Management)

```typescript
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
```

**На Render встанови:**
- CLOUDINARY_CLOUD_NAME = dm2gavkzs
- CLOUDINARY_API_KEY = 196748952826622
- CLOUDINARY_API_SECRET = твій secret

---

## 9. Real-time WebSocket (Socket.io)

Проєкт використовує Socket.io для чату в `src/socket/chatSocket.ts`:

```typescript
import setupChatSocket from './socket/chatSocket';

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS,
    credentials: true,
  },
});

setupChatSocket(io);
```

**На Render встанови:**
- ALLOWED_ORIGINS = https://dimmryi.netlify.app

---

## 10. CORS Configuration

```typescript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
```

---

## 11. Localization & Local Development

### 11.1 .env.local (НЕ КОМІТИТИ!)
```
PORT=5000
MONGO_DB=mongodb://localhost:27017/realestatedb
NODE_ENV=development
GOOGLE_CLIENT_ID=твій_id
JWT_SECRET=dev_secret_key
COOKIE_SECRET=dev_cookie_key
EMAIL_USER=dimmryi@gmail.com
APP_PASSWORD=твій_app_password
RESEND_API_KEY=dev_key
CLOUDINARY_CLOUD_NAME=dm2gavkzs
CLOUDINARY_API_KEY=196748952826622
CLOUDINARY_API_SECRET=dev_secret
ALLOWED_ORIGINS=http://localhost:5173
FRONTEND_URL=http://localhost:5173
NGROK_AUTH_TOKEN=optional_dev
```

### 11.2 Запуск локально
```bash
pnpm install
pnpm build
pnpm dev
```

---

## 12. Тестування

```bash
pnpm test              # один раз
pnpm test:watch       # режим спостереження
pnpm test:coverage    # звіт про покриття
```

Email service тести використовують mocks (Resend, Nodemailer).

---

## 13. Pre-Deployment Checklist

- ✅ `pnpm build` — без помилок
- ✅ `pnpm test` — всі тести проходять
- ✅ `.env` та `node_modules` в `.gitignore`
- ✅ Всі env variables на Render Dashboard ✓
- ✅ NODE_ENV = production
- ✅ PORT = 5000
- ✅ MONGO_DB connection string коректна
- ✅ Graceful shutdown в index.ts
- ✅ Socket.io CORS налаштована
- ✅ Health check endpoint: GET /health

---

## 14. Common Issues & Solutions

### Socket.io не підключається
- Перевір ALLOWED_ORIGINS в Render vars
- Переконайся, що httpServer.listen() використовується
- Перевір CORS у Socket.io config

### Email не відправляється
- Перевір RESEND_API_KEY на Render Dashboard
- Для Gmail: використовуй APP_PASSWORD, не звичайний пароль
- Перевір EMAIL_USER + APP_PASSWORD пара

### Mongoose connection timeout
- Додай 0.0.0.0/0 до MongoDB Atlas whitelist
- Перевір maxPoolSize в MONGO_DB URL
- Переконайся, що connection string коректна

### Cloudinary помилки
- Перевір CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET
- Ключи не мають мати пробіли
- Перевір облік Cloudinary не заблокований

---

## 15. Performance Tips (Render Free Tier = 0.5GB RAM)

- Мінімізуй ініціалізацію при startup
- Connection pooling: maxPoolSize=10
- Використовуй `.lean()` для read операцій
- Кешування часто запитуваних даних
- Логуй з ISO timestamp: `[${new Date().toISOString()}]`

---

## 16. Корисні Команди

```bash
# Local build & test
pnpm build
NODE_ENV=production pnpm start

# Check size
du -sh node_modules

# Git commit before deploy
git add .
git commit -m "Feature"
git push origin main
```

**Render автоматично задеплоїть коли ти запушить в main branch!**

---

## 17. Render Free Tier Обмеження

- ⏸️ Auto-spin down після 15 хв неактивності
- 💾 0.5GB RAM
- 📧 Email: 100/день (Resend free)
- 📸 Cloudinary: unlimited free tier
- 📊 MongoDB: free tier Atlas

**Рекомендація:** Upgrade на Hobby plan ($7/мес) для production 🚀
