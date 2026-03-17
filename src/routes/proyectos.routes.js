import { Router } from 'express';
import { obtenerProyectoPublico, actualizarTimelinePublico, agregarArchivoPublico, actualizarPagos } from '../controllers/proyectos.controller.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const router = Router();

// Multer para proyectos (guardar en /uploads/projects)
const uploadsDir = path.join(process.cwd(), 'uploads', 'projects');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({ destination: (req, file, cb) => cb(null, uploadsDir), filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`) });
const upload = multer({ storage });

router.get('/:id/dashboard-publico', obtenerProyectoPublico);
router.patch('/:id/timeline-publico', actualizarTimelinePublico);
router.post('/:id/archivos-publicos', upload.single('file'), agregarArchivoPublico);
router.patch('/:id/pagos', actualizarPagos);

export default router;
 
