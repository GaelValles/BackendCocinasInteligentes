import { Router } from 'express';
import { obtenerProyectoPublico, actualizarTimelinePublico, agregarArchivoPublico, actualizarPagos } from '../controllers/proyectos.controller.js';
import multer from 'multer';

const router = Router();

// Multer en memoria para enviar directamente a proveedor remoto.
const upload = multer({ storage: multer.memoryStorage() });

router.get('/:id/dashboard-publico', obtenerProyectoPublico);
router.patch('/:id/timeline-publico', actualizarTimelinePublico);
router.post('/:id/archivos-publicos', upload.single('file'), agregarArchivoPublico);
router.patch('/:id/pagos', actualizarPagos);

export default router;
 
