import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();

/**
 * Payments Endpoints
 */
router.post('/checkout-reference', authMiddleware, PaymentsController.createCheckoutReference);
router.post('/checkout-group-reference', authMiddleware, PaymentsController.createGroupCheckoutReference);
router.post('/confirm-checkout', authMiddleware, PaymentsController.confirmCheckout);
router.post('/link-to-pay', authMiddleware, PaymentsController.createLinkToPay);
router.post('/webhook', PaymentsController.handleWebhook);
router.post('/refund', authMiddleware, roleGuard(UserRoleEnum.ADMIN), PaymentsController.refund);

router.post('/withdraw', authMiddleware, roleGuard(UserRoleEnum.ARTISTA), PaymentsController.withdraw);
router.get('/withdrawals', authMiddleware, roleGuard(UserRoleEnum.ARTISTA), PaymentsController.getArtistWithdrawals);
router.get('/transactions', authMiddleware, roleGuard(UserRoleEnum.ARTISTA), PaymentsController.getArtistTransactions);

// Admin routes
router.put('/admin/withdrawals/:id', authMiddleware, roleGuard(UserRoleEnum.ADMIN), PaymentsController.updateWithdrawalStatus);
router.get('/admin/withdrawals', authMiddleware, roleGuard(UserRoleEnum.ADMIN), PaymentsController.getAllWithdrawals);

export default router;
