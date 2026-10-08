import { Router } from 'express';
import {
    obtenerProyectoPublico,
    actualizarTimelinePublico,
    agregarArchivoPublico,
    actualizarPagos,
    actualizarDatosContratoProyecto
} from '../controllers/proyectos.controller.js';
import { authRequired } from '../middlewares/validateToken.js';
import multer from 'multer';

const router = Router();

// Multer en memoria para enviar directamente a proveedor remoto.
const upload = multer({ storage: multer.memoryStorage() });

router.get('/:id/dashboard-publico', obtenerProyectoPublico);
router.patch('/:id/timeline-publico', actualizarTimelinePublico);
router.post('/:id/archivos-publicos', upload.single('file'), agregarArchivoPublico);
router.patch('/:id/pagos', actualizarPagos);
router.patch('/:codigo/datos-contrato', authRequired, actualizarDatosContratoProyecto);

export default router;
 
