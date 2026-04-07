import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { requireEmployee } from '../middlewares/roleValidator.js';
import {
    upload,
    subirArchivo,
    subirMultiples,
    eliminarArchivo,
    obtenerArchivosCliente,
    obtenerArchivosPorTipo,
    obtenerArchivosTarea,
    obtenerArchivosPanel
} from '../controllers/archivos.controller.js';

const router = Router();

// ========== RUTAS DE ARCHIVOS ==========

/**
 * Subir un archivo (provider automatico: Cloudinary para documentos formales,
 * Dropbox para flujo heredado y fallback local cuando aplica).
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
 * Subir multiples archivos (provider automatico por tipo/ruta)
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
    upload.array('files', 10),
    subirMultiples
);

/**
 * DELETE /api/archivos/:id
 * Eliminar archivo por ID (de ClienteArchivo)
 */
router.delete(
    '/:id',
    authRequired,
    eliminarArchivo
);

/**
 * GET /api/clientes/:clienteId/archivos
 * Obtener archivos de un cliente (con filtro opcional por tipo)
 */
router.get(
    '/cliente/:clienteId',
    authRequired,
    obtenerArchivosCliente
);

/**
 * GET /api/clientes/:clienteId/archivos/:tipo
 * Obtener archivos de un cliente por tipo específico
 */
router.get(
    '/cliente/:clienteId/tipo/:tipo',
    authRequired,
    obtenerArchivosPorTipo
);

/**
 * GET /api/tareas/:tareaId/archivos
 * Obtener archivos asociados a una tarea
 */
router.get(
    '/tarea/:tareaId',
    authRequired,
    obtenerArchivosTarea
);

/**
 * GET /api/clientes/panel/:codigo/archivos
 * Obtener archivos del panel del cliente (agrupados por tipo)
 */
router.get(
    '/panel/:codigo',
    authRequired,
    obtenerArchivosPanel
);

export default router;
