import { Router } from 'express';
import multer from 'multer';
import { getMyProfile, listArtistProfiles, getArtistProfileById, getArtistAvailability, createOrUpdateProfile } from './artist-profiles.controller';
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

// GET /api/artist-profiles/me — my profile (artista only)
router.get('/me', roleGuard(UserRoleEnum.ARTISTA), getMyProfile);

// GET /api/artist-profiles — list all (cliente, admin, organizacion, soporte)
router.get('/', roleGuard(UserRoleEnum.CLIENTE, UserRoleEnum.ADMIN, UserRoleEnum.ORGANIZACION, UserRoleEnum.SOPORTE), listArtistProfiles);

// GET /api/artist-profiles/:id — by id (artista own only; client, admin, soporte any)
router.get('/:id', roleGuard(UserRoleEnum.ARTISTA, UserRoleEnum.CLIENTE, UserRoleEnum.ADMIN, UserRoleEnum.SOPORTE), getArtistProfileById);

// GET /api/artist-profiles/:id/availability — status summary (any logged user)
router.get('/:id/availability', (req: any, res: any) => getArtistAvailability(req, res));

// PUT /api/artist-profiles — create or update (artista only); accepts JSON or multipart with optional photo file
router.put('/', roleGuard(UserRoleEnum.ARTISTA), upload.single('photo'), createOrUpdateProfile);

export default router;
