import { Router } from 'express';
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
    eliminarTarea
} from '../controllers/tareas.controller.js';

const router = Router();

// Obtener tareas (query: scope, assignedTo, stage, status)
router.get('/', obtenerTareas);
router.get('/:id', obtenerTarea);

router.patch('/:id/etapa', cambiarEtapa);
router.patch('/:id/estado', cambiarEstado);

router.patch('/:id/notas', actualizarNotas);

// Soporta multipart/form-data con campo 'files' o JSON body { archivos: [...] }
router.post('/:id/archivos', upload.array('files'), agregarArchivos);

// Crear / actualizar / eliminar tareas (opciones para integración)
router.post('/', crearTarea);
// Aceptar tanto PUT como PATCH para actualizaciones parciales desde el frontend
router.put('/:id', actualizarTarea);
router.patch('/:id', actualizarTarea);
router.delete('/:id', eliminarTarea);

export default router;

