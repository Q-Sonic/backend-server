import { Router } from 'express';
import multer from 'multer';
import { getMyProfile, getClientProfileById, createOrUpdateProfile } from './client-profiles.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';
import { MAX_IMAGE_SIZE } from '../../helper/storage';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_SIZE },
});

router.use(authMiddleware);

// GET /api/client-profiles/me — my profile (cliente only)
router.get('/me', roleGuard(UserRoleEnum.CLIENTE), getMyProfile);

// GET /api/client-profiles/:id — by id (admin, soporte only)
router.get('/:id', roleGuard(UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getClientProfileById);

// PUT /api/client-profiles — create or update (cliente only); accepts JSON or multipart with optional photo file
router.put('/', roleGuard(UserRoleEnum.CLIENTE), upload.single('photo'), createOrUpdateProfile);

export default router;
