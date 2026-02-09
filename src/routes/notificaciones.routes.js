import { Router } from "express";
import { authRequired } from "../middlewares/validateToken.js";
import {
    obtenerNotificaciones,
    obtenerNotificacionesNoLeidas,
    marcarComoLeida,
    marcarTodasComoLeidas,
    obtenerContadorNoLeidas
} from "../controllers/notificaciones.controller.js";

const router = Router();

// Obtener todas las notificaciones del usuario autenticado
router.get('/', authRequired, obtenerNotificaciones);

// Obtener solo notificaciones no leídas
router.get('/no-leidas', authRequired, obtenerNotificacionesNoLeidas);

// Obtener contador de notificaciones no leídas
router.get('/contador', authRequired, obtenerContadorNoLeidas);

// Marcar una notificación como leída
router.put('/:id/leer', authRequired, marcarComoLeida);

// Marcar todas las notificaciones como leídas
router.put('/leer-todas', authRequired, marcarTodasComoLeidas);

export default router;
