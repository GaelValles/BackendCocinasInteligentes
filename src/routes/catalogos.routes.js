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

export default router;
