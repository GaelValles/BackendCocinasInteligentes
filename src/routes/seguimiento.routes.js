import { Router } from 'express';
import { validateSchema } from '../middlewares/validator.middleware.js';
import { trackingAuthRequired } from '../middlewares/trackingToken.middleware.js';
import { authRequired } from '../middlewares/validateToken.js';
import { loginSeguimientoSchema } from '../schemas/seguimiento.schema.js';
import {
    loginSeguimiento,
    getProyectoSeguimiento,
    getArchivosSeguimiento,
    getPagosSeguimiento,
    logoutSeguimiento,
    actualizarEstatusPublico,
    debugProyectos,
    debugTrackingAccess,
    debugValidateCodigo
} from '../controllers/seguimiento.controller.js';

const router = Router();

// === Rutas públicas de seguimiento ===
router.post('/login', validateSchema(loginSeguimientoSchema), loginSeguimiento);
router.post('/auth', validateSchema(loginSeguimientoSchema), loginSeguimiento);
router.post('/access', validateSchema(loginSeguimientoSchema), loginSeguimiento);

// === Rutas protegidas con tracking token ===
router.get('/proyecto', trackingAuthRequired, getProyectoSeguimiento);
router.get('/archivos', trackingAuthRequired, getArchivosSeguimiento);
router.get('/pagos', trackingAuthRequired, getPagosSeguimiento);
router.post('/logout', trackingAuthRequired, logoutSeguimiento);

// Actualización administrativa del estatus que ve el portal público.
router.patch('/proyectos/:codigo', authRequired, actualizarEstatusPublico);

// === DEBUG endpoints (solo desarrollo) ===
router.get('/debug/proyectos', debugProyectos);
router.get('/debug/access', debugTrackingAccess);
router.post('/debug/validate', debugValidateCodigo);

export default router;
