import { Router } from 'express';
import path from 'node:path';
import { authRequired } from '../middlewares/validateToken.js';
import { validateSchema } from '../middlewares/validator.middleware.js';
import { upload as uploadArchivoDropbox, subirArchivo } from '../controllers/archivos.controller.js';
import {
    obtenerTareas,
    obtenerTarea,
    cambiarEtapa,
    cambiarEstado,
    actualizarNotas,
    upload,
    agregarArchivos,
    prepararCargaDisenoDropbox,
    crearTarea,
    actualizarTarea,
    asignarTrabajadoresTarea,
    eliminarTarea
} from '../controllers/tareas.controller.js';
import {
    crearTareaSchema,
    actualizarTareaSchema,
    asignarTareaSchema,
    cambiarEtapaSchema,
    cambiarEstadoSchema,
    agregarArchivosSchema
} from '../schemas/tareas.schema.js';

const router = Router();
const supportedDesignMimes = new Set([
    'application/pdf',
    'application/x-sketchup',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/octet-stream'
]);
const supportedDesignExtensions = new Set(['.pdf', '.skp', '.jpg', '.jpeg', '.png', '.webp']);

const parseDropboxFile = (req, res, next) => {
    uploadArchivoDropbox.single('file')(req, res, (error) => {
        if (!error && req.file) {
            const extension = path.extname(req.file.originalname || '').toLowerCase();
            const mimeType = String(req.file.mimetype || '').toLowerCase();
            if (!supportedDesignExtensions.has(extension) || !supportedDesignMimes.has(mimeType)) {
                return res.status(415).json({ success: false, message: 'Tipo de archivo de diseño no permitido' });
            }
        }
        if (!error) return next();
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 415;
        return res.status(status).json({ success: false, message: error.message || 'Archivo no permitido' });
    });
};

router.use(authRequired);

// Obtener tareas (query: scope, assignedTo, stage, status)
router.get('/', obtenerTareas);
router.get('/:id', obtenerTarea);

router.patch('/:id/etapa', validateSchema(cambiarEtapaSchema), cambiarEtapa);
router.patch('/:id/estado', validateSchema(cambiarEstadoSchema), cambiarEstado);

router.patch('/:id/notas', actualizarNotas);

router.post('/:tareaId/archivos/dropbox', parseDropboxFile, prepararCargaDisenoDropbox, subirArchivo);

// Soporta multipart/form-data con campo 'files' o JSON body { archivos: [...] }
router.post('/:id/archivos', upload.array('files'), (req, res, next) => {
    if (req.files && req.files.length) return next();
    return validateSchema(agregarArchivosSchema)(req, res, next);
}, agregarArchivos);

// Crear / actualizar / eliminar tareas (opciones para integración)
router.post('/', validateSchema(crearTareaSchema), crearTarea);
router.put('/:id', validateSchema(actualizarTareaSchema), actualizarTarea);
router.patch('/:id', validateSchema(actualizarTareaSchema), actualizarTarea);
router.put('/:id/asignar-trabajadores', validateSchema(asignarTareaSchema), asignarTrabajadoresTarea);
router.patch('/:id/asignar-trabajadores', validateSchema(asignarTareaSchema), asignarTrabajadoresTarea);
router.delete('/:id', eliminarTarea);

export default router;

