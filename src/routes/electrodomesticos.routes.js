import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authRequired } from '../middlewares/validateToken.js';
import {
    listarElectrodomesticos,
    crearElectrodomestico,
    actualizarElectrodomestico,
    eliminarElectrodomestico,
    uploadImagenCloudinary
} from '../controllers/electrodomesticos.controller.js';

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

// Public routes (no authentication required)
router.get('/', listarElectrodomesticos);

// Protected routes (authentication required)
router.post('/', authRequired, crearElectrodomestico);
router.patch('/:id', authRequired, actualizarElectrodomestico);
router.delete('/:id', authRequired, eliminarElectrodomestico);

// Upload image to Cloudinary
router.post('/upload/imagen', authRequired, upload.single('file'), uploadImagenCloudinary);

export default router;
