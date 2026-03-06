import { Router } from 'express';
import {
    listMyServices,
    getServiceById,
    createService,
    updateService,
    deleteService,
    listAllServicesByArtistId,
} from './artist-services.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';

const router = Router();

router.use(authMiddleware);

// GET /api/artist-services — list current artist's services
router.get('/', listMyServices);

// GET /api/artist-services/all/:artistId — list all services by artist id
router.get('/all/:artistId', listAllServicesByArtistId);

// GET /api/artist-services/:id
router.get('/:id', getServiceById);

// POST /api/artist-services — create service (only artist or admin)
router.post('/', roleGuard(UserRoleEnum.ARTISTA), createService);

// PUT /api/artist-services/:id — update service (only artist or admin)
router.put('/:id', roleGuard(UserRoleEnum.ARTISTA), updateService);

// DELETE /api/artist-services/:id (only artist or admin)
router.delete('/:id', roleGuard(UserRoleEnum.ARTISTA, UserRoleEnum.ADMIN), deleteService);

export default router;
