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
import { errorMiddleware } from './middleware/error.middleware';
import { sendSuccess } from './utils/response.util';
import { setupSwagger } from './config/swagger';

const app = express();

// ─── Security & Parsing Middleware ───────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    sendSuccess(res, { uptime: process.uptime() }, 'Q-Music API is running 🎵');
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/artist-services', artistServicesRoutes);
app.use('/api/client-profiles', clientProfilesRoutes);
app.use('/api/artist-profiles', artistProfilesRoutes);

// ─── Swagger Docs ─────────────────────────────────────────────────────────────
setupSwagger(app);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorMiddleware);

export default app;
