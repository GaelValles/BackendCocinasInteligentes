import { Router } from 'express';
import { authRequired } from '../middlewares/validateToken.js';
import {
    obtenerPanelClientePorCodigo,
    buscarCodigoCliente,
    obtenerArchivosClientePorCodigo
} from '../controllers/clientesPanel.controller.js';

const router = Router();

router.use(authRequired);

router.get('/panel/:codigo', obtenerPanelClientePorCodigo);
router.get('/panel/:codigo/archivos', obtenerArchivosClientePorCodigo);
router.get('/buscar-codigo', buscarCodigoCliente);

export default router;
