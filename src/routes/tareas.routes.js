import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { validateSchema } from '../middlewares/validator.middleware.js';
import {
    obtenerTareas,
    obtenerTarea,
    cambiarEtapa,
    cambiarEstado,
    actualizarNotas,
    upload,
    agregarArchivos,
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

router.use(authRequired);

// Obtener tareas (query: scope, assignedTo, stage, status)
router.get('/', obtenerTareas);
router.get('/:id', obtenerTarea);

router.patch('/:id/etapa', validateSchema(cambiarEtapaSchema), cambiarEtapa);
router.patch('/:id/estado', validateSchema(cambiarEstadoSchema), cambiarEstado);

router.patch('/:id/notas', actualizarNotas);

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

