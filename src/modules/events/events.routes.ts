import { Router } from 'express';
import { EventsController } from './events.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();
const controller = new EventsController();

// 🔒 Artist only routes
router.use(authMiddleware);
router.use(roleGuard(UserRoleEnum.ARTISTA));

/**
 * @swagger
 * /api/events/calendar:
 *   get:
 *     summary: Get calendar events for artist
 *     tags: [Events]
 *     parameters:
 *       - name: start
 *         in: query
 *         schema: { type: 'string', format: 'date' }
 *       - name: end
 *         in: query
 *         schema: { type: 'string', format: 'date' }
 *     responses:
 *       200:
 *         description: List of events
 */
router.get('/calendar', (req, res) => controller.getCalendar(req, res));

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get extended event detail (client info, download links)
 *     tags: [Events]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       200:
 *         description: Extended event detail
 */
router.get('/:id', (req, res) => controller.getDetail(req, res));

export default router;
