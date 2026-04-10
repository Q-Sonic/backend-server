import { Router } from 'express';
import { ContractsController } from './contracts.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';
import { validateRequest } from '../../middleware/validate.middleware';
import { 
    createContractRequestSchema, 
    updateContractStatusRequestSchema, 
    addPaymentRequestSchema 
} from '../../schemas/contract.schema';

const router = Router();
const controller = new ContractsController();

// 🔒 All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /contracts/my-history:
 *   get:
 *     summary: Obtener historial de contratos del cliente
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Historial de contratos exitoso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ContractRecord' } }
 */
router.get('/my-history', roleGuard(UserRoleEnum.CLIENTE), (req, res) => controller.getMyHistory(req, res));

/**
 * @swagger
 * /contracts/artist-history:
 *   get:
 *     summary: Obtener historial de contratos del artista
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Historial de contratos del artista
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ContractRecord' } }
 */
router.get('/artist-history', roleGuard(UserRoleEnum.ARTISTA), (req, res) => controller.getArtistHistory(req, res));

/**
 * @swagger
 * /contracts/{id}:
 *   get:
 *     summary: Obtener detalle específico de un contrato
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del contrato
 */
router.get('/:id', (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /contracts:
 *   post:
 *     summary: Crear una nueva solicitud de contratación/reserva
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateContractBody' }
 *     responses:
 *       201:
 *         description: Contrato creado
 */
router.post('/', roleGuard(UserRoleEnum.CLIENTE), validateRequest(createContractRequestSchema), (req, res) => controller.create(req, res));

/**
 * @swagger
 * /contracts/{id}/status:
 *   patch:
 *     summary: Actualizar estado del contrato (Aceptar/Rechazar/Completar)
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: ['ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED'] }
 *     responses:
 *       200:
 *         description: Estado actualizado
 */
router.patch('/:id/status', validateRequest(updateContractStatusRequestSchema), (req, res) => controller.updateStatus(req, res));

/**
 * @swagger
 * /contracts/{id}/payments:
 *   post:
 *     summary: Registrar un pago para un contrato
 *     tags: [Contracts]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, example: 50000 }
 *               reference: { type: string, example: 'TRANSF-123' }
 *               method: { type: string, example: 'transfer' }
 *     responses:
 *       200:
 *         description: Pago registrado
 */
router.post('/:id/payments', roleGuard(UserRoleEnum.ARTISTA), validateRequest(addPaymentRequestSchema), (req, res) => controller.addPayment(req, res));

export default router;
