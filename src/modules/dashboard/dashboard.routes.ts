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
 * /api/dashboard/stats:
 *   get:
 *     summary: Artist dashboard summary (events growth, balance, visits)
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
router.get('/stats', (req, res) => controller.getSummary(req, res));

export default router;
