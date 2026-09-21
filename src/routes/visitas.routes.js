import { Router } from 'express';
import {
    crearVisita,
    obtenerDisponibilidadVisita,
    listarVisitas,
    actualizarVisita,
    eliminarVisita
} from '../controllers/visitas.controller.js';
import { authRequired } from '../middlewares/validateToken.js';

const router = Router();

// Public booking flow: no session required, captcha required on creation.
router.get('/disponibilidad', obtenerDisponibilidadVisita);
router.get('/horarios-ocupados', obtenerDisponibilidadVisita);
router.get('/', authRequired, listarVisitas);
router.post('/', crearVisita);
router.post('/agendarVisita', crearVisita);
router.patch('/:id', authRequired, actualizarVisita);
router.delete('/:id', authRequired, eliminarVisita);

export default router;
