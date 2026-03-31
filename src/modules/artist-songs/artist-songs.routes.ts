import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
    createSong,
    deleteSong,
    listMySongs,
    listSongsByArtistId,
    updateSong,
} from './artist-songs.controller';
import { MAX_AUDIO_SIZE, MAX_IMAGE_SIZE } from '../../helper/storage';

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.max(MAX_AUDIO_SIZE, MAX_IMAGE_SIZE) },
});

router.use(authMiddleware);

router.get('/me', listMySongs);
router.get('/all/:artistId', listSongsByArtistId);
router.post('/', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), createSong);
router.put('/:id', upload.fields([{ name: 'cover', maxCount: 1 }]), updateSong);
router.delete('/:id', deleteSong);

export default router;
