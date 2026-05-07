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

// 🔒 All routes require authentication
router.use(authMiddleware);

/**
 * Contracts Endpoints
 */
router.get('/my-history', roleGuard(UserRoleEnum.CLIENTE), ContractsController.getMyHistory);
router.get('/artist-history', roleGuard(UserRoleEnum.ARTISTA), ContractsController.getArtistHistory);
router.get('/:id', ContractsController.getById);

router.post('/', roleGuard(UserRoleEnum.CLIENTE), validateRequest(createContractRequestSchema), ContractsController.create);
router.patch('/:id/status', validateRequest(updateContractStatusRequestSchema), ContractsController.updateStatus);
router.post('/:id/cancel', roleGuard(UserRoleEnum.CLIENTE), ContractsController.cancelByClient);
router.post('/:id/payments', roleGuard(UserRoleEnum.ARTISTA), validateRequest(addPaymentRequestSchema), ContractsController.addPayment);
router.post('/sign-all', roleGuard(UserRoleEnum.ARTISTA), ContractsController.signAll);

export default router;
