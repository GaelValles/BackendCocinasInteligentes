import { Router } from 'express';
import {
    obtenerMateriales,
    obtenerHerrajes,
    obtenerColores,
    obtenerTiposProyecto,
    obtenerTiposCubierta,
    obtenerEscenariosLevantamiento,
    obtenerEscenariosCotizador,
    obtenerEmpleados
} from '../controllers/catalogos.controller.js';
import { authRequired } from '../middlewares/validateToken.js';
import { crearMaterial, actualizarMaterial, eliminarMaterial } from '../controllers/materiales.controller.js';

const router = Router();

// Rutas públicas (no requieren autenticación)
router.get('/materiales', obtenerMateriales);
router.get('/herrajes', obtenerHerrajes);
router.get('/colores', obtenerColores);
router.get('/tipos-proyecto', obtenerTiposProyecto);
router.get('/tipos-cubierta', obtenerTiposCubierta);
router.get('/escenarios-levantamiento', obtenerEscenariosLevantamiento);
router.get('/escenarios-cotizador', obtenerEscenariosCotizador);

// Rutas que requieren autenticación
router.get('/empleados', authRequired, obtenerEmpleados);

// Admin endpoints (frontend expects POST/PATCH/DELETE under /api/catalogos)
router.post('/materiales', authRequired, crearMaterial);
router.patch('/materiales/:id', authRequired, actualizarMaterial);
router.delete('/materiales/:id', authRequired, eliminarMaterial);

// Allow admin managing herrajes via the same materiales controller as fallback
router.post('/herrajes', authRequired, crearMaterial);
router.patch('/herrajes/:id', authRequired, actualizarMaterial);
router.delete('/herrajes/:id', authRequired, eliminarMaterial);

export default router;
