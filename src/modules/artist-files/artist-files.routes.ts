import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleGuard } from '../../middleware/role.middleware';
import { UserRoleEnum } from '../../enum/roles.enum';
import {
    deleteArtistFile,
    listArtistFiles,
    replaceArtistFile,
    uploadArtistFile,
} from './artist-files.controller';
import { MAX_PDF_SIZE } from '../../helper/storage';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PDF_SIZE },
});

router.use(authMiddleware);
router.use(roleGuard(UserRoleEnum.ARTISTA));

/**
 * @swagger
 * /artist-files:
 *   get:
 *     tags: [Artist Files]
 *     summary: Listar archivos del artista autenticado
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [contract, technical_rider]
 *     responses:
 *       200:
 *         description: Lista de archivos del artista
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ArtistFileRecord' }
 */
router.get('/', listArtistFiles);

/**
 * @swagger
 * /artist-files:
 *   post:
 *     tags: [Artist Files]
 *     summary: Subir archivo del artista (contract o technical_rider)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, type]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               type:
 *                 type: string
 *                 enum: [contract, technical_rider]
 *     responses:
 *       201:
 *         description: Archivo creado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/ArtistFileRecord' }
 */
router.post('/', upload.single('file'), uploadArtistFile);

/**
 * @swagger
 * /artist-files/{id}:
 *   put:
 *     tags: [Artist Files]
 *     summary: Reemplazar archivo del artista por un nuevo PDF
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Archivo actualizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { $ref: '#/components/schemas/ArtistFileRecord' }
 */
router.put('/:id', upload.single('file'), replaceArtistFile);

/**
 * @swagger
 * /artist-files/{id}:
 *   delete:
 *     tags: [Artist Files]
 *     summary: Eliminar archivo del artista y desanclarlo de servicios
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Archivo eliminado
 */
router.delete('/:id', deleteArtistFile);

export default router;

