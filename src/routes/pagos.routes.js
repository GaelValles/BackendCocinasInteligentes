import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import { registrarPago, listarPagosPorOrden } from '../controllers/pagos.controller.js';

const router = Router();

router.use(authRequired);

router.post('/', registrarPago);
router.get('/orden/:ordenId', listarPagosPorOrden);

export default router;
