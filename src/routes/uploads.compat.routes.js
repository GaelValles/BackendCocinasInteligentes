import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authRequired } from '../middlewares/validateToken.js';
import { requireEmployee } from '../middlewares/roleValidator.js';
import { upload, subirArchivo, subirMultiples } from '../controllers/archivos.controller.js';
import { uploadFileToCloudinary } from '../libs/cloudinary.js';

const router = Router();

const cloudinaryUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
		const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
		const extension = path.extname(file.originalname || '').toLowerCase();

		if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
			cb(null, true);
			return;
		}

		cb(new Error('Solo se permiten imágenes (JPEG, PNG)'), false);
	}
});

const uploadCloudinaryCompat = async (req, res) => {
	try {
		const file = req.file || req.files?.[0];
		if (!file) {
			return res.status(400).json({
				success: false,
				message: 'No se proporcionó archivo'
			});
		}

		const result = await uploadFileToCloudinary(
			file.buffer,
			file.originalname,
			file.mimetype,
			'equipamiento'
		);

		return res.json({
			success: true,
			message: 'Imagen subida correctamente',
			data: {
				secureUrl: result.url,
				thumbnailUrl: result.url,
				publicId: result.publicId,
				key: result.key,
				provider: result.provider
			}
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: 'Error al subir imagen a Cloudinary',
			error: error?.message || 'unknown'
		});
	}
};

// Compatibilidad con rutas usadas por frontend legado/actual.
router.post('/uploads', authRequired, requireEmployee, upload.any(), subirArchivo);
router.post('/uploads/multiple', authRequired, requireEmployee, upload.array('files', 10), subirMultiples);
router.post('/dropbox/upload', authRequired, requireEmployee, upload.any(), subirArchivo);
router.post('/files/upload', authRequired, requireEmployee, upload.any(), subirArchivo);
router.post('/upload', authRequired, requireEmployee, upload.any(), subirArchivo);
router.post('/upload/multiple', authRequired, requireEmployee, upload.array('files', 10), subirMultiples);

// Compatibilidad con frontend equipamiento (electrodomesticos/extras)
router.post('/uploads/cloudinary', authRequired, requireEmployee, cloudinaryUpload.any(), uploadCloudinaryCompat);
router.post('/cloudinary/upload', authRequired, requireEmployee, cloudinaryUpload.any(), uploadCloudinaryCompat);
router.post('/media/cloudinary', authRequired, requireEmployee, cloudinaryUpload.any(), uploadCloudinaryCompat);

export default router;
