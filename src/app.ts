import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'express-async-errors';

import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import storageRoutes from './modules/storage/storage.routes';
import artistServicesRoutes from './modules/artist-services/artist-services.routes';
import clientProfilesRoutes from './modules/client-profiles/client-profiles.routes';
import artistProfilesRoutes from './modules/artist-profiles/artist-profiles.routes';
import contractsRoutes from './modules/contracts/contracts.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import eventsRoutes from './modules/events/events.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { sendSuccess } from './utils/response.util';
import { setupSwagger } from './config/swagger';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';
import { getEnv } from './config/env';
import { apiLimiter, authLimiter } from './middleware/rate-limit.middleware';

const app = express();
const { CORS_ORIGIN } = getEnv();

app.set('trust proxy', 1);

// ─── Logging & Security ──────────────────────────────────────────────────────
app.use(requestLoggerMiddleware);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use('/api', apiLimiter); // Application-wide limit
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Server is live
 */
app.get('/api/health', (_req, res) => {
    sendSuccess(res, { uptime: process.uptime() }, 'Q-Music API is running 🎵');
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes); // Stricter limit for auth
app.use('/api/users', usersRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/artist-services', artistServicesRoutes);
app.use('/api/client-profiles', clientProfilesRoutes);
app.use('/api/artist-profiles', artistProfilesRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);

// ─── Swagger Docs ─────────────────────────────────────────────────────────────
setupSwagger(app);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
