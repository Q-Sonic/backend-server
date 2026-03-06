import { Router } from 'express';
import multer from 'multer';
import { getMyProfile, getArtistProfileById, createOrUpdateProfile } from './artist-profiles.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

// GET /api/artist-profiles/me — my profile (artista only)
router.get('/me', roleGuard(UserRoleEnum.ARTISTA), getMyProfile);

// GET /api/artist-profiles/:id — by id (artista own only; client, admin, soporte any)
router.get('/:id', roleGuard(UserRoleEnum.ARTISTA, UserRoleEnum.CLIENTE, UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getArtistProfileById);

// PUT /api/artist-profiles — create or update (artista only); accepts JSON or multipart with optional photo file
router.put('/', roleGuard(UserRoleEnum.ARTISTA), upload.single('photo'), createOrUpdateProfile);

export default router;
