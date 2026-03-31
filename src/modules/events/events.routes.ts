import { Router } from 'express';
import { EventsController } from './events.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();
const controller = new EventsController();

// 🔒 Artist only routes
router.use(authMiddleware);
// roleGuard removed from global level to allow multiple roles (Artist, Cliente, etc.)

/**
 * @swagger
 * /events/calendar:
 *   get:
 *     summary: Obtener eventos del calendario para el artista
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: start
 *         in: query
 *         schema: { type: 'string', format: 'date' }
 *         description: Fecha inicio (YYYY-MM-DD)
 *       - name: end
 *         in: query
 *         schema: { type: 'string', format: 'date' }
 *         description: Fecha fin (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Lista de eventos para el calendario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ContractRecord' } }
 */
router.get('/calendar', (req, res) => controller.getCalendar(req, res));

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Obtener detalle extendido del evento (datos del cliente, links de descarga)
 *     tags: [Events]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: 'string' }
 *     responses:
 *       200:
 *         description: Detalle extendido del evento
 */
router.get('/:id', (req, res) => controller.getDetail(req, res));

export default router;
