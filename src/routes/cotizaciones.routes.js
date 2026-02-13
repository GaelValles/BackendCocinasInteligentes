import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { validateSchema } from '../middlewares/validator.middleware.js';
import { cotizacionBorradorSchema } from '../schemas/cotizacion.schema.js';
import {
    getCotizadorConfig,
    guardarBorrador,
    obtenerCotizacion,
    listarCotizaciones,
    generarPdfCliente,
    generarHojaTaller
} from '../controllers/cotizaciones.controller.js';

const router = Router();

// Público: configuración del cotizador para el frontend
router.get('/config', getCotizadorConfig);

// Requieren autenticación
router.get('/', authRequired, listarCotizaciones);
router.post('/borrador', authRequired, validateSchema(cotizacionBorradorSchema), guardarBorrador);
router.put('/borrador/:id', authRequired, guardarBorrador);
router.get('/:id', authRequired, obtenerCotizacion);
router.post('/:id/pdf-cliente', authRequired, generarPdfCliente);
router.post('/:id/hoja-taller', authRequired, generarHojaTaller);

export default router;
