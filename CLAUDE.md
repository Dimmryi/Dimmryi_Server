# Real Estate Server — Developer Guide

Deployed on **Render.com** (auto-deploy on push to `main`). Frontend: **......netlify.app**.

---

## 1. Tech Stack

| Layer | Package | Version |
|---|---|---|
| Web framework | `express` | 4.21.2 |
| Database ORM | `mongoose` | 8.9.5 |
| Real-time | `socket.io` | 4.8.3 |
| Image/video hosting | `cloudinary` | 2.6.1 |
| Session store | `connect-mongo` | 5.1.0 |
| Auth tokens | `jsonwebtoken` | 9.0.2 |
| Google OAuth | `google-auth-library` | 10.1.0 |
| Email fallback | `nodemailer` | 7.0.5 |
| Email primary | `resend` | 6.10.0 |
| Password hashing | `bcryptjs` | 3.0.2 |

---

## 2. Scripts

```bash
pnpm build          # tsc → dist/
pnpm start          # node dist/index.js  (Render uses this)
pnpm dev            # ts-node src/index.ts (local)
pnpm test           # jest
pnpm test:watch     # jest --watch
pnpm test:coverage  # jest --coverage
```

---

## 3. Environment Variables (Render Dashboard)

**Do not rename these — they are set in Render production environment.**

```
NODE_ENV=production
PORT=5000
MONGO_DB=<some strinng>
JWT_SECRET=<32+ char secret>
COOKIE_SECRET=<cookie secret>
GOOGLE_CLIENT_ID=<google oauth client id>
RESEND_API_KEY=<resend api key>
EMAIL_USER=<email>
APP_PASSWORD=<16-char google app password>
CLOUDINARY_CLOUD_NAME=<some strinng>
CLOUDINARY_API_KEY=<some strinng>
CLOUDINARY_API_SECRET=<cloudinary secret>
ALLOWED_ORIGINS=<some strinng>
FRONTEND_URL=<some strinng>
```

**APP_PASSWORD** is a Google App Password (not your Gmail password). Enable 2FA → https://myaccount.google.com/apppasswords → copy 16-char token.

---

## 4. Project Architecture

```
src/
├── index.ts                  # App bootstrap: middleware, DB, server, socket
├── emailService.ts           # Resend primary + Nodemailer SMTP fallback
├── types.d.ts                # Global type augmentations
├── controllers/
│   ├── AgentController.ts
│   ├── CommentsController.ts
│   ├── ListingController.ts
│   └── UserController.ts
├── routes/
│   ├── AgentsRoutes.ts
│   ├── CommentsRoutes.ts
│   ├── ListingRoutes.ts
│   └── UserRoutes.ts
│   # TODO: migrate inline routes from index.ts:
│   # AuthRoutes.ts, NotificationRoutes.ts, ChatRoutes.ts,
│   # AdsRoutes.ts, CloudinaryRoutes.ts
├── middlewares/
│   └── AuthMiddleware.ts     # requireAuth, checkAuth, isAdmin
├── models/
│   ├── AdsModel.ts
│   ├── AgentModel.ts
│   ├── ChatModel.ts
│   ├── CommentModel.ts
│   ├── CounterModel.ts
│   ├── ListingModel.ts
│   ├── NotificationModel.ts
│   └── UserModel.ts
├── socket/
│   └── chatSocket.ts         # Socket.io buyer-seller chat
├── utils/
│   └── getNextListingNumber.ts
└── __tests__/
    └── emailService.test.ts
```

### Route ↔ Controller convention

Every domain gets a `routes/XRoutes.ts` + `controllers/XController.ts` pair.  
`index.ts` contains only: middleware setup, DB connection, server bootstrap, socket init.  
Business logic lives in controllers, not in route files.

---

## 5. Server Bootstrap (index.ts)

```typescript
const port = Number(process.env.PORT) || 5000;

// HTTP + WebSocket — must use httpServer.listen(), NOT app.listen()
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.ALLOWED_ORIGINS, credentials: true },
});
setupChatSocket(io);
httpServer.listen(port, '0.0.0.0');
```

### Graceful shutdown

```typescript
const gracefulShutdown = () => {
  httpServer.close(() => { mongoose.connection.close(); process.exit(0); });
};
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

---

## 6. Authentication

- **Session** (express-session + connect-mongo, 7-day TTL, httpOnly + sameSite=none + secure=true)
- **JWT** (1-hour expiry, used alongside sessions for Google OAuth)
- **Google OAuth** — verifies ID token server-side via `google-auth-library`
- **Password reset** — 32-byte crypto token, 30-min TTL, one-time use, stored plain in DB

Middleware chain: `requireAuth` → loads user from session → attaches to `req.session.user`.  
Admin actions use `isAdmin` middleware on top.

---

## 7. API Endpoints (current)

### Fully migrated to routes+controllers
| Domain | Route file | Controller |
|---|---|---|
| Listings | `ListingRoutes.ts` | `ListingController.ts` |
| Users | `UserRoutes.ts` | `UserController.ts` |
| Comments | `CommentsRoutes.ts` | `CommentsController.ts` |
| Agents | `AgentsRoutes.ts` | `AgentController.ts` |

### Still inline in index.ts (pending migration)
- `POST /login`, `POST /api/auth/google`, `GET /session`, `POST /logout`
- `POST /api/auth/forgot-password`, `GET /api/auth/reset-password/validate`, `POST /api/auth/reset-password`
- `GET|POST /api/videos`, `POST /api/videos/set-featured`, `POST /api/videos/modified-string`, `GET /api/video`, `DELETE /api/videos/:publicId`
- `GET|POST|PUT|DELETE /api/notification(s)...`
- `POST /api/chat/init`, `GET /api/chat/:chatId`, `GET /api/chat/listing/:listingId`, `PATCH /api/chat/:chatId/read`
- `POST /generate-signature`, `POST /generate-signature-video`, `POST /generate-signature-to-delete-video`
- `GET /api/listingsWithComparison` (listing create + geo-filtered notification dispatch)

### Utility
- `GET /healthz` — Render health check
- `GET /version` — deploy version info
- `GET /api/test` — basic smoke test

---

## 8. Known Issues (prioritized)

### High — fix before next feature
1. **CORS hardcoded** — `index.ts:116` uses literal `localhost` strings instead of `ALLOWED_ORIGINS` env var
2. **Duplicate import** — `listingRoutes` imported twice (lines 13 and 24)
3. **Unused env vars** — `CLOUD_NAME` (line 52) and `SECRET` (line 53) declared but never used
4. **Debug endpoint** — `GET /api/chat/debug/:chatId` (line 929) left in production code
5. **Orphan endpoint** — `POST /saveImageUrl` (line 229) saves to wrong model, not wired to any feature
6. **Test-only route** — `GET /api/protected` (line 129) has no business purpose

### Medium — next refactor
7. **Mixed-language comments** — Russian/Ukrainian comments in `index.ts` (forgot-password block)
8. **Business logic in index.ts** — haversine calculation and email dispatch in `POST /api/listingsWithComparison` should be a controller
9. **`bodyParser.urlencoded`** — redundant alongside `express.json()` for JSON API
10. **`let` for singletons** — `resendClient` and `transporter` in `emailService.ts` should be `const`
11. **No ObjectId validation** — `PUT /api/notification/:notificationId` (line 409) skips the isValid check that other endpoints have

### Low — quality improvements
12. **No pagination** — all list endpoints return full collections
13. **Heavy `any` usage** — controllers and middleware use `any` instead of typed request/response
14. **No indexes** on ListingModel, NotificationModel (only ChatModel has compound index)

---

## 9. Email Service

Primary: **Resend API** (`RESEND_API_KEY`), domain `noreply@dimmryi.site`.  
Fallback: **Gmail SMTP** via Nodemailer (`EMAIL_USER` + `APP_PASSWORD`).

```typescript
// emailService.ts
sendNotificationEmail({ to, subject, html })  // HTML email via Resend
sendEmail(to, subject, text)                  // Plain text wrapped in <p>
```

---

## 10. Real-time Chat (Socket.io)

File: `src/socket/chatSocket.ts`

Events:
- `join_chat(chatId)` — subscribe to room
- `send_message({ chatId, text, senderId, senderName })` — save to DB, broadcast, email seller on first message
- `messages_read(chatId)` — mark all unread as read, reset `notified` flag
- `new_message` — emitted to room after save
- `chat_error` — emitted on failure

Email notification fires only once per conversation (`chat.notified` flag gate).

---

## 11. Render Deployment

**Build Command**: `pnpm install && pnpm build`  
**Start Command**: `pnpm start`  
**Node Version**: 20.x  
**Auto-deploy**: push to `main` → Render rebuilds and restarts automatically

### Free tier limits
- Auto-spin-down after 15 min idle (cold start ~30s)
- 0.5 GB RAM
- Resend free tier: 100 emails/day
- MongoDB Atlas free tier: 512 MB storage

### Common issues

| Symptom | Check |
|---|---|
| Socket.io fails to connect | `ALLOWED_ORIGINS` in Render vars; `httpServer.listen()` used (not `app.listen()`) |
| Email not sent | `RESEND_API_KEY` set; `EMAIL_USER` + `APP_PASSWORD` valid pair |
| MongoDB timeout | `0.0.0.0/0` whitelisted in Atlas; `maxPoolSize=10` in connection string |
| Cloudinary errors | No spaces in `CLOUDINARY_API_SECRET`; account not suspended |

---

## 12. Pre-Deploy Checklist

- [ ] `pnpm build` — no TypeScript errors
- [ ] `pnpm test` — all tests pass
- [ ] `.env` and `node_modules` in `.gitignore`
- [ ] All env vars set on Render Dashboard
- [ ] No debug/temp endpoints left in code
- [ ] Health check reachable: `GET /healthz`

---