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
import artistSongsRoutes from './modules/artist-songs/artist-songs.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import landingLeadsRoutes from './modules/landing-leads/landing-leads.routes';
import artistFilesRoutes from './modules/artist-files/artist-files.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { sendSuccess } from './utils/response.util';
import { setupSwagger } from './config/swagger';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';
import { getEnv } from './config/env';
import { apiLimiter, authLimiter } from './middleware/rate-limit.middleware';

const app = express();
const { CORS_ORIGIN } = getEnv();

app.set('trust proxy', 1);

/**
 * ─── Logging & Security ───
 * 1. requestLoggerMiddleware: Registra cada petición entrante en consola para facilitar el debugging.
 * 2. helmet: Agrega headers de seguridad estándar para prevenir ataques comunes como XSS o Clickjacking.
 * 3. cors: Permite que el Frontend (React) se comunique con esta API desde otro dominio de forma segura.
 * 4. json/urlencoded: Parsean los cuerpos de las peticiones para que podamos acceder a req.body.
 */
app.use(requestLoggerMiddleware);
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use('/api', apiLimiter); // Application-wide limit
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * ─── Health Check ───
 * Endpoint simple para verificar que el servidor está respondiendo correctamente.
 * Útil para monitoreo y para que Docker sepa si el contenedor está saludable.
 */
app.get('/api/health', (_req, res) => {
    sendSuccess(res, { uptime: process.uptime(), version: '1.1.6' }, 'Q-Music API is running 🎵');
});

/**
 * ─── Routes ───
 * Cargamos las rutas de forma modular por dominio de negocio (Auth, Users, Contracts, etc.).
 * Cada módulo maneja sus propios controladores y servicios internos.
 */
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/artist-services', artistServicesRoutes);
app.use('/api/client-profiles', clientProfilesRoutes);
app.use('/api/artist-profiles', artistProfilesRoutes);
app.use('/api/contracts', contractsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/artist-songs', artistSongsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/landing-leads', landingLeadsRoutes);
app.use('/api/artist-files', artistFilesRoutes);

/**
 * ─── Swagger Docs ───
 * Inicializa la documentación interactiva en /api/docs.
 */
setupSwagger(app);

/**
 * ─── 404 Handler ───
 * Si llegamos aquí es porque ninguna de las rutas anteriores hizo match.
 */
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
});

/**
 * ─── Global Error Handler ───
 * Sumidero final de errores. Cualquier excepción no capturada en los controllers
 * termina aquí para ser logueada y devuelta de forma controlada al cliente.
 */
app.use(errorMiddleware);

export default app;
