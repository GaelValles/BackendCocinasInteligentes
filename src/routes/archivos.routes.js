import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { requireEmployee } from '../middlewares/roleValidator.js';
import {
    upload,
    subirArchivo,
    subirMultiplesArchivos,
    eliminarArchivo,
    obtenerArchivosTarea,
    obtenerArchivosProyecto
} from '../controllers/archivos.controller.js';

const router = Router();

// ========== RUTAS DE ARCHIVOS ==========

/**
 * Subir un archivo a DigitalOcean Spaces
 * POST /api/archivos/upload
 * Content-Type: multipart/form-data
 * Body: 
 *   - file: archivo (imagen o PDF)
 *   - tipo: "render" | "pdf" | "contrato" | "otro"
 *   - relacionadoA: "tarea" | "proyecto" | "cotizacion"
 *   - relacionadoId: ID del recurso relacionado
 * Permisos: Admin, arquitecto, ingeniero
 */
router.post(
    '/upload',
    authRequired,
    requireEmployee,
    upload.single('file'),
    subirArchivo
);

/**
 * Subir múltiples archivos a DigitalOcean Spaces
 * POST /api/archivos/upload-multiple
 * Content-Type: multipart/form-data
 * Body: 
 *   - files: array de archivos
 *   - tipo: "render" | "pdf" | "contrato" | "otro"
 *   - relacionadoA: "tarea" | "proyecto" | "cotizacion"
 *   - relacionadoId: ID del recurso relacionado
 * Permisos: Admin, arquitecto, ingeniero
 */
router.post(
    '/upload-multiple',
    authRequired,
    requireEmployee,
    upload.array('files', 10), // Máximo 10 archivos
    subirMultiplesArchivos
);

/**
 * Eliminar archivo de DigitalOcean Spaces
 * DELETE /api/archivos
 * Body: { key: "ruta/del/archivo" }
 * Permisos: Admin, arquitecto, ingeniero
 */
router.delete(
    '/',
    authRequired,
    requireEmployee,
    eliminarArchivo
);

/**
 * Obtener archivos de una tarea
 * GET /api/archivos/tarea/:id
 * Permisos: Admin, arquitecto, ingeniero (solo sus tareas)
 */
router.get(
    '/tarea/:id',
    authRequired,
    requireEmployee,
    obtenerArchivosTarea
);

/**
 * Obtener archivos públicos de un proyecto
 * GET /api/archivos/proyecto/:id
 * Permisos: Todos los usuarios autenticados (con restricciones)
 */
router.get(
    '/proyecto/:id',
    authRequired,
    obtenerArchivosProyecto
);

export default router;
