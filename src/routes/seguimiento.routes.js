import { Router } from 'express';
import { validateSchema } from '../middlewares/validator.middleware.js';
import { trackingAuthRequired } from '../middlewares/trackingToken.middleware.js';
import { loginSeguimientoSchema } from '../schemas/seguimiento.schema.js';
import {
    loginSeguimiento,
    getProyectoSeguimiento,
    getArchivosSeguimiento,
    getPagosSeguimiento,
    logoutSeguimiento,
    debugProyectos,
    debugTrackingAccess,
    debugValidateCodigo
} from '../controllers/seguimiento.controller.js';

const router = Router();

// === Rutas públicas de seguimiento ===
router.post('/login', validateSchema(loginSeguimientoSchema), loginSeguimiento);

// === Rutas protegidas con tracking token ===
router.get('/proyecto', trackingAuthRequired, getProyectoSeguimiento);
router.get('/archivos', trackingAuthRequired, getArchivosSeguimiento);
router.get('/pagos', trackingAuthRequired, getPagosSeguimiento);
router.post('/logout', trackingAuthRequired, logoutSeguimiento);

// === DEBUG endpoints (solo desarrollo) ===
router.get('/debug/proyectos', debugProyectos);
router.get('/debug/access', debugTrackingAccess);
router.post('/debug/validate', debugValidateCodigo);

export default router;
