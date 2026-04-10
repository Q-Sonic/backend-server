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

/**
 * @swagger
 * tags:
 *   name: Artist Songs
 *   description: Gestión de canciones y archivos de audio del artista
 */

/**
 * @swagger
 * /artist-songs/me:
 *   get:
 *     tags: [Artist Songs]
 *     summary: Listar mis canciones (Artista autenticado)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Lista de canciones
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ArtistSongRecord' } }
 */
router.get('/me', listMySongs);

/**
 * @swagger
 * /artist-songs/all/{artistId}:
 *   get:
 *     tags: [Artist Songs]
 *     summary: Listar todas las canciones de un artista específico
 *     parameters:
 *       - in: path
 *         name: artistId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de canciones del artista
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/ArtistSongRecord' } }
 */
router.get('/all/:artistId', listSongsByArtistId);

/**
 * @swagger
 * /artist-songs:
 *   post:
 *     tags: [Artist Songs]
 *     summary: Subir una nueva canción
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [audio]
 *             properties:
 *               title: { type: string, example: 'Mi Gran Hit' }
 *               isFeatured: { type: boolean, example: false }
 *               audio: { type: string, format: binary, description: 'Archivo de audio (mp3, wav, webm)' }
 *               cover: { type: string, format: binary, description: 'Imagen de portada (jpg, png, webp)' }
 *     responses:
 *       201:
 *         description: Canción creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/ArtistSongRecord' }
 */
router.post('/', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), createSong);

/**
 * @swagger
 * /artist-songs/{id}:
 *   put:
 *     tags: [Artist Songs]
 *     summary: Actualizar información o portada de una canción
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               isFeatured: { type: boolean }
 *               cover: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Canción actualizada
 */
router.put('/:id', upload.fields([{ name: 'cover', maxCount: 1 }]), updateSong);

/**
 * @swagger
 * /artist-songs/{id}:
 *   delete:
 *     tags: [Artist Songs]
 *     summary: Eliminar una canción
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Canción eliminada exitosamente
 */
router.delete('/:id', deleteSong);

export default router;
