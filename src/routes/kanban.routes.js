import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import {
	getCitasColumn,
	getDisenosColumn,
	getCotizacionColumn,
	getContratoColumn,
	getSeguimientoAlertas,
	getEtapaAllColumn
} from '../controllers/kanban.controller.js';

const router = Router();

router.use(authRequired);

router.get('/seguimiento/alertas', getSeguimientoAlertas);

// Compatibilidad con frontend: GET /api/kanban/:etapa/all
router.get('/:etapa/all', getEtapaAllColumn);

// One endpoint per Kanban column — simple, explicit, avoids mapping ambiguity
router.get('/citas', getCitasColumn);
router.get('/disenos', getDisenosColumn);
router.get('/cotizacion', getCotizacionColumn);
router.get('/contrato', getContratoColumn);

// Alias compatibles con el frontend
router.get('/citas/column', getCitasColumn);
router.get('/disenos/column', getDisenosColumn);
router.get('/cotizacion/column', getCotizacionColumn);
router.get('/contrato/column', getContratoColumn);

export default router;
