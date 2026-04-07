import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { requireEmployee } from '../middlewares/roleValidator.js';
import { upload, subirArchivo, subirMultiples } from '../controllers/archivos.controller.js';

const router = Router();

// Compatibilidad con rutas usadas por frontend legado/actual.
router.post('/uploads', authRequired, requireEmployee, upload.any(), subirArchivo);
router.post('/uploads/multiple', authRequired, requireEmployee, upload.array('files', 10), subirMultiples);
router.post('/dropbox/upload', authRequired, requireEmployee, upload.any(), subirArchivo);
router.post('/files/upload', authRequired, requireEmployee, upload.any(), subirArchivo);

export default router;
