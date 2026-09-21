import { Router } from 'express';
import {
    crearVisita,
    obtenerDisponibilidadVisita
} from '../controllers/visitas.controller.js';

const router = Router();

// Public booking flow: no session required, captcha required on creation.
router.get('/disponibilidad', obtenerDisponibilidadVisita);
router.get('/horarios-ocupados', obtenerDisponibilidadVisita);
router.post('/', crearVisita);
router.post('/agendarVisita', crearVisita);

export default router;
