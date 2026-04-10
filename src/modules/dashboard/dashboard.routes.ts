import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();
const controller = new DashboardController();

// 🔒 Artist only routes
router.use(authMiddleware);
router.use(roleGuard(UserRoleEnum.ARTISTA));

/**
 * @swagger
 * /dashboard/stats:
 *   get:
 *     summary: Resumen del dashboard del artista (crecimiento, balance, visitas)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Estadísticas del dashboard
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/DashboardStats' }
 */
router.get('/stats', (req, res) => controller.getSummary(req, res));

export default router;
