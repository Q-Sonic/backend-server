import { Router } from 'express';
import { ContractsController } from './contracts.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();
const controller = new ContractsController();

// 🔒 All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /contracts/my-history:
 *   get:
 *     summary: Get client's contracts and events history
 *     tags: [Contracts]
 *     responses:
 *       200:
 *         description: List of contracts
 */
router.get('/my-history', roleGuard(UserRoleEnum.CLIENTE), (req, res) => controller.getMyHistory(req, res));

/**
 * @swagger
 * /contracts/:id:
 *   get:
 *     summary: Get specific contract detail
 *     tags: [Contracts]
 */
router.get('/:id', (req, res) => controller.getById(req, res));

/**
 * @swagger
 * /contracts:
 *   post:
 *     summary: Create a new contract/booking
 *     tags: [Contracts]
 */
router.post('/', roleGuard(UserRoleEnum.CLIENTE), (req, res) => controller.create(req, res));

/**
 * @swagger
 * /contracts/:id/status:
 *   patch:
 *     summary: Update contract status (Artist/Admin)
 *     tags: [Contracts]
 */
router.patch('/:id/status', (req, res) => controller.updateStatus(req, res));

/**
 * @swagger
 * /contracts/:id/payments:
 *   post:
 *     summary: Register a payment for a contract (Artist/Admin)
 *     tags: [Contracts]
 */
router.post('/:id/payments', (req, res) => controller.addPayment(req, res));

export default router;
