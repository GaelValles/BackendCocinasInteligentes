import { Router } from "express";
import { authRequired } from "../middlewares/validateToken.js";
import {
    crearDiseno,
    obtenerDisenos,
    obtenerDiseno,
    actualizarDiseno,
    eliminarDiseno,
    obtenerDisenosDisponibles,
    subirDisenoPreliminar,
    obtenerDisenosPendientes,
    autorizarDiseno,
    rechazarDiseno,
    obtenerDisenosPorArquitecto
} from "../controllers/disenos.controller.js";

const router = Router();

// ========== RUTAS PÚBLICAS ==========

// Ruta para ver diseños disponibles/autorizados (usado en "Ver diseños disponibles" del diagrama)
router.get('/disponibles', obtenerDisenosDisponibles);

// ========== RUTAS AUTENTICADAS ==========

// Rutas para arquitectos
// Subir diseño preliminar (usado cuando orden no tiene diseño)
router.post('/preliminar', authRequired, subirDisenoPreliminar);

// Obtener diseños pendientes de autorización (para admin)
router.get('/pendientes', authRequired, obtenerDisenosPendientes);

// Obtener diseños creados por un arquitecto específico
router.get('/arquitecto/:arquitectoId', authRequired, obtenerDisenosPorArquitecto);

// Rutas para admin
// Autorizar diseño preliminar (cambia estado a 'autorizado')
router.put('/:id/autorizar', authRequired, autorizarDiseno);

// Rechazar diseño preliminar (cambia estado a 'borrador')
router.put('/:id/rechazar', authRequired, rechazarDiseno);

// Rutas CRUD completas para administración de diseños
router.post('/agregarDiseno', authRequired, crearDiseno);
router.get('/verDisenos', authRequired, obtenerDisenos);
router.get('/verDiseno/:id', authRequired, obtenerDiseno);
router.put('/actualizarDiseno/:id', authRequired, actualizarDiseno);
router.delete('/eliminarDiseno/:id', authRequired, eliminarDiseno);

export default router;
