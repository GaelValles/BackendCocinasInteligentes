import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { validateSchema } from '../middlewares/validator.middleware.js';
import { cotizacionBorradorSchema } from '../schemas/cotizacion.schema.js';
import {
    getCotizadorConfig,
    crear,
    guardarBorrador,
    listar,
    obtenerPorId,
    obtenerCotizacion,
    listarCotizaciones,
    actualizar,
    cambiarEstado,
    eliminar,
    generarPdfCliente,
    generarHojaTaller
} from '../controllers/cotizaciones.controller.js';

const router = Router();

// Público: configuración del cotizador para el frontend
router.get('/config', getCotizadorConfig);

// Crear nueva cotización
router.post('/', authRequired, crear);

// Guardar borrador (mantener para compatibilidad)
router.post('/borrador', authRequired, validateSchema(cotizacionBorradorSchema), guardarBorrador);
router.put('/borrador/:id', authRequired, validateSchema(cotizacionBorradorSchema), guardarBorrador);

// Listar cotizaciones (ambas formas para compatibilidad)
router.get('/', authRequired, listar);

// Obtener cotización por ID
router.get('/:id', authRequired, obtenerPorId);

// Actualizar cotización
router.patch('/:id', authRequired, actualizar);

// Eliminar cotización
router.delete('/:id', authRequired, eliminar);

// Cambiar estado de cotización
router.patch('/:id/estado', authRequired, cambiarEstado);

// Generar PDFs
router.post('/:id/pdf-cliente', authRequired, generarPdfCliente);
router.post('/:id/hoja-taller', authRequired, generarHojaTaller);

export default router;
