import { Router } from 'express';
import { getCitasColumn, getDisenosColumn, getCotizacionColumn, getContratoColumn } from '../controllers/kanban.controller.js';

const router = Router();

// One endpoint per Kanban column — simple, explicit, avoids mapping ambiguity
router.get('/citas', getCitasColumn);
router.get('/disenos', getDisenosColumn);
router.get('/cotizacion', getCotizacionColumn);
router.get('/contrato', getContratoColumn);

export default router;
