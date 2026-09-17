import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authRequired } from '../middlewares/validateToken.js';
import {
    listarExtras,
    crearExtra,
    actualizarExtra,
    eliminarExtra,
    uploadImagenCloudinary
} from '../controllers/extras.controller.js';
import {
    listarExtrasCategorias,
    crearExtraCategoria,
    actualizarExtraCategoria,
    eliminarExtraCategoria
} from '../controllers/extrasCategoria.controller.js';

const router = Router();

// Multer configuration for image uploads
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP)'), false);
    }
};

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter
});

router.get('/categorias', listarExtrasCategorias);

router.post('/categorias', authRequired, crearExtraCategoria);
router.patch('/categorias/:id', authRequired, actualizarExtraCategoria);
router.delete('/categorias/:id', authRequired, eliminarExtraCategoria);

router.get('/', listarExtras);

router.post('/', authRequired, crearExtra);
router.patch('/:id', authRequired, actualizarExtra);
router.delete('/:id', authRequired, eliminarExtra);

router.post('/upload/imagen', authRequired, upload.single('file'), uploadImagenCloudinary);

export default router;
