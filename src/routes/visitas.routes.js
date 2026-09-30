import { Router } from 'express';
import {
    crearVisita,
    obtenerDisponibilidadVisita,
    listarVisitas,
    actualizarVisita,
    eliminarVisita,
    actualizarEstadoOperativoVisita
} from '../controllers/visitas.controller.js';
import { authRequired } from '../middlewares/validateToken.js';

const router = Router();

// Public booking flow: no session required, captcha required on creation.
router.get('/disponibilidad', obtenerDisponibilidadVisita);
router.get('/horarios-ocupados', obtenerDisponibilidadVisita);
router.get('/', authRequired, listarVisitas);
const authorizeLinkedVisit = (req, res, next) => (
    req.body?.tareaId ? authRequired(req, res, next) : next()
);
router.post('/', authorizeLinkedVisit, crearVisita);
router.post('/agendarVisita', authorizeLinkedVisit, crearVisita);
router.patch('/:id/status', authRequired, actualizarEstadoOperativoVisita);
router.patch('/:id', authRequired, actualizarVisita);
router.delete('/:id', authRequired, eliminarVisita);

export default router;
